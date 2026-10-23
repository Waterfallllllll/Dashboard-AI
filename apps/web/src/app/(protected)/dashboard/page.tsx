import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";

export const metadata: Metadata = {
  title: "Главная"
};

export default function DashboardPage() {
  return (
    <PageScaffold
      description="Здесь появятся время, погода, календарь, рутины, таймер и новости."
      eyebrow="Сегодня"
      title="Ваш день в одном месте"
    />
  );
}
