"use client";

import { useLayoutEffect, type ReactNode } from "react";

import type { Session } from "@dashboard/contracts";
import { createContext, useContext } from "react";

import { WidgetPreferencesSync } from "@/features/dashboard";
import { RoutineLibrarySync } from "@/features/routines";
import { setCsrfToken } from "@/lib/api/csrf-memory";

const SessionContext = createContext<Session | null>(null);

type ApiSessionProviderProps = Readonly<{
  session: Session | null;
  children: ReactNode;
}>;

export function ApiSessionProvider({ session, children }: ApiSessionProviderProps) {
  useLayoutEffect(() => {
    setCsrfToken(session?.csrfToken ?? null);

    return () => {
      setCsrfToken(null);
    };
  }, [session]);

  return (
    <SessionContext.Provider value={session}>
      {session ? (
        <>
          <WidgetPreferencesSync />
          <RoutineLibrarySync />
        </>
      ) : null}
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): Session | null {
  return useContext(SessionContext);
}
