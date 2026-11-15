import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { ApiSessionProvider } from "@/features/session";
import { readSession } from "@/lib/session/read-session";

type ProtectedLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Косвенный вызов cookies() не переводит маршрут в динамический: сборка иначе
// отдаёт всем одну страницу без сессии.
export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const session = await readSession();

  return (
    <ApiSessionProvider session={session}>
      <AppShell>{children}</AppShell>
    </ApiSessionProvider>
  );
}
