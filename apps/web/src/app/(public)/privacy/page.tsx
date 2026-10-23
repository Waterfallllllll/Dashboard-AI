import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";

export const metadata: Metadata = {
  title: "Политика конфиденциальности"
};

export default function PrivacyPage() {
  return (
    <PageScaffold
      description="Текст политики будет опубликован до запуска авторизации и внешних интеграций."
      eyebrow="Документы"
      title="Политика конфиденциальности"
    />
  );
}
