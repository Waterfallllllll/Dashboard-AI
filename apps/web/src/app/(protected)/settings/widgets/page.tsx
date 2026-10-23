import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";

export const metadata: Metadata = {
  title: "Настройка виджетов"
};

export default function WidgetSettingsPage() {
  return (
    <PageScaffold
      description="Управляйте составом, порядком и размером карточек на главном экране."
      eyebrow="Настройки"
      title="Виджеты"
    />
  );
}
