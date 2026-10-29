"use client";

import {
  Blocks,
  CalendarCheck2,
  LayoutDashboard,
  PlugZap,
  Settings2,
  UserRound
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import { isExactPath, isMobileSettingsPath, isPathPrefix } from "./navigation-model";
import styles from "./app-navigation.module.scss";

type NavigationVariant = "sidebar" | "bottom";

type NavigationItem = Readonly<{
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: (pathname: string) => boolean;
}>;

const dashboardItem: NavigationItem = {
  href: "/dashboard",
  icon: LayoutDashboard,
  label: "Главная",
  isActive: (pathname) => isExactPath(pathname, "/dashboard")
};

const routinesItem: NavigationItem = {
  href: "/settings/routines",
  icon: CalendarCheck2,
  label: "Рутины",
  isActive: (pathname) => isPathPrefix(pathname, "/settings/routines")
};

const sidebarItems: readonly NavigationItem[] = [
  dashboardItem,
  {
    href: "/settings/widgets",
    icon: Blocks,
    label: "Виджеты",
    isActive: (pathname) => isPathPrefix(pathname, "/settings/widgets")
  },
  routinesItem,
  {
    href: "/settings/integrations",
    icon: PlugZap,
    label: "Интеграции",
    isActive: (pathname) => isPathPrefix(pathname, "/settings/integrations")
  },
  {
    href: "/settings/profile",
    icon: UserRound,
    label: "Профиль",
    isActive: (pathname) => isPathPrefix(pathname, "/settings/profile")
  }
];

const bottomItems: readonly NavigationItem[] = [
  dashboardItem,
  routinesItem,
  {
    href: "/settings/widgets",
    icon: Settings2,
    label: "Настройки",
    isActive: (pathname) => isMobileSettingsPath(pathname)
  }
];

type AppNavigationProps = Readonly<{
  variant: NavigationVariant;
}>;

export function AppNavigation({ variant }: AppNavigationProps) {
  const pathname = usePathname();
  const items = variant === "sidebar" ? sidebarItems : bottomItems;

  return (
    <nav
      aria-label={variant === "sidebar" ? "Основная навигация" : "Мобильная навигация"}
      className={styles[variant]}
    >
      {items.map(({ href, icon: Icon, isActive, label }) => {
        const active = isActive(pathname);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={styles.link}
            data-active={active || undefined}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" className={styles.icon} strokeWidth={1.9} />
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
