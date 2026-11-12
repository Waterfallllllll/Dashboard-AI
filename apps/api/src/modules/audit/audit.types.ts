export const AUDIT_ACTIONS = [
  "login",
  "logout",
  "integration_connected",
  "integration_disconnected",
  "account_deleted"
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGETS = ["google", "google_calendar", "telegram"] as const;

export type AuditTarget = (typeof AUDIT_TARGETS)[number];

export type AuditEventInput = {
  readonly userId: string | null;
  readonly action: AuditAction;
  readonly target: AuditTarget | null;
};

export type AuditRecord = AuditEventInput & {
  readonly createdAt: Date;
  readonly deleteAt: Date;
};

export type AuditRecorder = {
  record(input: AuditEventInput): Promise<void>;
  forgetUser(userId: string): Promise<void>;
};

export type AuditRepository = {
  insert(record: AuditRecord): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
};
