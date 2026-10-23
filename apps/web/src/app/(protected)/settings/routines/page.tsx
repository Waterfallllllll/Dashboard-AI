import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";

export const metadata: Metadata = {
  title: "Рутины"
};

export default function RoutinesPage() {
  return (
    <PageScaffold
      description="Создавайте повторяющиеся дела и следите за выполнением на выбранную дату."
      eyebrow="Планирование"
      title="Рутинные дела"
    />
  );
}
