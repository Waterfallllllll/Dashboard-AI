import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { DevicePermissions, IntegrationList, parseCalendarReturn } from "@/features/integrations";

export const metadata: Metadata = {
  title: "Интеграции"
};

type IntegrationsPageProps = Readonly<{
  searchParams: Promise<{
    calendar?: string | string[];
  }>;
}>;

export default async function IntegrationsPage({ searchParams }: IntegrationsPageProps) {
  const { calendar } = await searchParams;

  return (
    <PageScaffold
      contentVariant="plain"
      description="Подключайте календарь, Telegram, геолокацию и каналы уведомлений."
      eyebrow="Настройки"
      title="Интеграции"
    >
      <IntegrationList calendarReturn={parseCalendarReturn(calendar)} />
      <DevicePermissions />
    </PageScaffold>
  );
}
