import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";
import { RoutineManagement } from "@/features/routines";

export const metadata: Metadata = {
  title: "Рутины"
};

export default function RoutinesPage() {
  return (
    <PageScaffold
      contentVariant="plain"
      description="Создавайте повторяющиеся дела и следите за выполнением на выбранную дату."
      eyebrow="Планирование"
      title="Рутинные дела"
    >
      <RoutineManagement />
    </PageScaffold>
  );
}
