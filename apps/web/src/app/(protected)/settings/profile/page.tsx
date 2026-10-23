import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { ThemeControl } from "@/components/ui/theme-control";

export const metadata: Metadata = {
  title: "Профиль"
};

export default function ProfilePage() {
  return (
    <PageScaffold
      description="Настройте внешний вид, часовой пояс и параметры аккаунта."
      eyebrow="Настройки"
      title="Профиль"
    >
      <ThemeControl />
    </PageScaffold>
  );
}
