import type { Metadata } from "next";

import { LoginScreen, parseLoginStatus } from "@/features/auth";
import { isApiReachable } from "@/lib/session/read-session";

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
  const apiReady = await isApiReachable();

  return (
    <LoginScreen
      {...(apiReady ? { googleHref: "/api/v1/auth/google" } : {})}
      status={parseLoginStatus(rawStatus)}
    />
  );
}
