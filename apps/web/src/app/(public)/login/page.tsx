import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";

export const metadata: Metadata = {
  title: "Вход"
};

export default function LoginPage() {
  return (
    <PageScaffold
      description="Авторизация через Google будет подключена на следующем этапе разработки."
      eyebrow="Добро пожаловать"
      title="Соберите важное в одном спокойном пространстве"
    />
  );
}
