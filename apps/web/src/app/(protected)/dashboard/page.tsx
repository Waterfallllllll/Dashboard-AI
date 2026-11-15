import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { DashboardBoard } from "@/features/dashboard";
import { loadDashboardView } from "@/lib/dashboard/load-dashboard";
import { readSession } from "@/lib/session/read-session";

export const metadata: Metadata = {
  title: "Главная"
};

export default async function DashboardPage() {
  const session = await readSession();
  const remote = session ? await loadDashboardView(session) : null;

  return (
    <PageScaffold
      contentVariant="plain"
      description="Время, погода, календарь, рутины, таймер и новости собираются в одной сетке и обновляются независимо."
      eyebrow="Сегодня"
      title="Ваш день в одном месте"
    >
      <DashboardBoard {...(remote ? { remote } : {})} />
    </PageScaffold>
  );
}
