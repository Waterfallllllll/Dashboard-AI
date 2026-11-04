import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { DevicePermissions, IntegrationList } from "@/features/integrations";

export const metadata: Metadata = {
  title: "Интеграции"
};

export default function IntegrationsPage() {
  return (
    <PageScaffold
      contentVariant="plain"
      description="Подключайте календарь, Telegram, геолокацию и каналы уведомлений."
      eyebrow="Настройки"
      title="Интеграции"
    >
      <IntegrationList />
      <DevicePermissions />
    </PageScaffold>
  );
}
