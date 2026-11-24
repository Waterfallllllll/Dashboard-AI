import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import {
  DevicePermissions,
  IntegrationList,
  type CalendarConnectionStatus
} from "@/features/integrations";

export const metadata: Metadata = {
  title: "Интеграции"
};

type IntegrationsPageProps = Readonly<{
  searchParams: Promise<{ readonly calendar?: string | string[] }>;
}>;

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const params = await searchParams;

  return (
    <PageScaffold
      contentVariant="plain"
      description="Подключайте календарь, Telegram, геолокацию и каналы уведомлений."
      eyebrow="Настройки"
      title="Интеграции"
    >
      <IntegrationList calendarStatus={calendarStatus(params.calendar)} />
      <DevicePermissions />
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
