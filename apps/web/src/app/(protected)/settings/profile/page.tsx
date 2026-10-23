import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { ProfileSettings } from "@/features/profile";

export const metadata: Metadata = {
  title: "Профиль"
};

export default function ProfilePage() {
  return (
    <PageScaffold
      contentVariant="plain"
      description="Настройте внешний вид, часовой пояс и параметры аккаунта."
      eyebrow="Настройки"
      title="Профиль"
    >
      <ProfileSettings />
    </PageScaffold>
  );
}
