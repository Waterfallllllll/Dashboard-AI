import type { Metadata } from "next";

import { LoginScreen, parseLoginStatus } from "@/features/auth";

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

  return <LoginScreen status={parseLoginStatus(rawStatus)} />;
}
