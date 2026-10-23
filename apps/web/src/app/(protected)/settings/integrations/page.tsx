import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";

export const metadata: Metadata = {
  title: "Интеграции"
};

export default function IntegrationsPage() {
  return (
    <PageScaffold
      description="Подключайте календарь, Telegram, геолокацию и каналы уведомлений."
      eyebrow="Настройки"
      title="Интеграции"
    />
  );
}
