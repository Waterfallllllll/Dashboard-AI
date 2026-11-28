import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { DashboardBoard } from "@/features/dashboard";

export const metadata: Metadata = {
  title: "Главная"
};

export default function DashboardPage() {
  return (
    <PageScaffold
      contentVariant="plain"
      description="Время, погода, календарь, рутины, таймер и новости собираются в одной сетке и обновляются независимо."
      eyebrow="Сегодня"
      title="Ваш день в одном месте"
    >
      <DashboardBoard serverTimer />
    </PageScaffold>
  );
}
