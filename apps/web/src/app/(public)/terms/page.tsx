import type { Metadata } from "next";

import { PageScaffold } from "@/components/ui/page-scaffold";

export const metadata: Metadata = {
  title: "Условия использования"
};

export default function TermsPage() {
  return (
    <PageScaffold
      description="Условия использования будут дополнены перед публичным запуском приложения."
      eyebrow="Документы"
      title="Условия использования"
    />
  );
}
