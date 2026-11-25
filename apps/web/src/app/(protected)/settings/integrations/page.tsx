import type { Metadata } from "next";
import { cookies } from "next/headers";

import { PageScaffold } from "@/components/ui/page-scaffold";
import {
  IntegrationList,
  calendarCardStatus,
  loadGoogleCalendarStatus,
  loadTelegramStatus,
  type CalendarConnectionStatus
} from "@/features/integrations";
import { internalApiOrigin } from "@/lib/api/internal-api-origin";
import { readServerWebPushPublicKey } from "@/lib/web-push-public-key";

export const metadata: Metadata = {
  title: "Интеграции"
};

type IntegrationsPageProps = Readonly<{
  searchParams: Promise<{ readonly calendar?: string | string[] }>;
}>;

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const params = await searchParams;
  const cookieHeader = (await cookies()).toString();
  const origin = internalApiOrigin(process.env.INTERNAL_API_URL);
  const [persistedCalendar, persistedTelegram] = await Promise.all([
    loadGoogleCalendarStatus(origin, cookieHeader),
    loadTelegramStatus(origin, cookieHeader)
  ]);

  return (
    <PageScaffold
      contentVariant="plain"
      description="Подключайте календарь, Telegram, геолокацию и каналы уведомлений."
      eyebrow="Настройки"
      title="Интеграции"
    >
      <IntegrationList
        calendarStatus={calendarCardStatus(persistedCalendar, calendarStatus(params.calendar))}
        telegramStatus={persistedTelegram}
        webPushPublicKey={readServerWebPushPublicKey()}
      />
    </PageScaffold>
  );
}

function calendarStatus(value: string | string[] | undefined): CalendarConnectionStatus | null {
  const status = Array.isArray(value) ? value[0] : value;

  if (status === "connected" || status === "cancelled" || status === "error") {
    return status;
  }

  return null;
}
