import { auditDeleteAt } from "../../infrastructure/mongodb/retention.js";
import {
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  type AuditEventInput,
  type AuditRecord,
  type AuditRecorder,
  type AuditRepository
} from "./audit.types.js";

export type { AuditEventInput, AuditRecord, AuditRecorder, AuditRepository };

const USER_ID = /^[a-f0-9]{24}$/;
const ACTIONS = new Set<string>(AUDIT_ACTIONS);

export const noopAudit: AuditRecorder = {
  async record() {
    return undefined;
  },
  async forgetUser() {
    return undefined;
  }
};

export class AuditService implements AuditRecorder {
  constructor(
    private readonly repository: AuditRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async record(input: AuditEventInput): Promise<void> {
    await this.repository.insert(buildAuditRecord(input, this.now()));
  }

  async forgetUser(userId: string): Promise<void> {
    if (!USER_ID.test(userId)) {
      throw new Error("Некорректный идентификатор пользователя в журнале аудита");
    }

    await this.repository.deleteForUser(userId);
  }
}

export function buildAuditRecord(input: AuditEventInput, createdAt: Date): AuditRecord {
  if (Number.isNaN(createdAt.getTime())) {
    throw new Error("Некорректная дата события аудита");
  }

  assertAuditShape(input);

  return {
    userId: input.userId,
    action: input.action,
    target: input.target,
    createdAt,
    deleteAt: auditDeleteAt(createdAt)
  };
}

function assertAuditShape(input: AuditEventInput): void {
  if (!ACTIONS.has(input.action)) {
    throw new Error("Неизвестное событие аудита");
  }

  if (input.target !== null && !AUDIT_TARGETS.includes(input.target)) {
    throw new Error("Неизвестная цель события аудита");
  }

  if (input.action === "account_deleted") {
    if (input.userId !== null || input.target !== null) {
      throw new Error("Удаление аккаунта записывается без идентификатора и цели");
    }

    return;
  }

  if (input.userId === null || !USER_ID.test(input.userId)) {
    throw new Error("Некорректный идентификатор пользователя в журнале аудита");
  }

  if (input.action === "login" && input.target !== "google") {
    throw new Error("Вход записывается только для Google");
  }

  if (input.action === "logout" && input.target !== null) {
    throw new Error("Выход записывается без цели");
  }

  if (
    (input.action === "integration_connected" || input.action === "integration_disconnected") &&
    input.target !== "google_calendar" &&
    input.target !== "telegram"
  ) {
    throw new Error("Событие интеграции требует календарь или Telegram");
  }
}
