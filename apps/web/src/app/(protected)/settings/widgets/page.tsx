import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { WidgetEditor } from "@/features/dashboard";

export const metadata: Metadata = {
  title: "Настройка виджетов"
};

export default function WidgetSettingsPage() {
  return (
    <PageScaffold
      contentVariant="plain"
      description="Управляйте составом, порядком, размером и параметрами карточек на главном экране."
      eyebrow="Настройки"
      title="Виджеты"
    >
      <WidgetEditor />
    </PageScaffold>
  );
}
