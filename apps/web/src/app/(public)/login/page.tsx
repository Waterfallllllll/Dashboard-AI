import type { Metadata } from "next";

import { LoginScreen } from "@/features/auth";

export const metadata: Metadata = {
  title: "Вход"
};

type LoginPageProps = Readonly<{
  searchParams: Promise<{
    status?: string | string[];
  }>;
}>;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { status: rawStatus } = await searchParams;
  const statusValue = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  const status =
    statusValue === "cancelled" || statusValue === "error" || statusValue === "loading"
      ? statusValue
      : null;

  return <LoginScreen status={status} />;
}
