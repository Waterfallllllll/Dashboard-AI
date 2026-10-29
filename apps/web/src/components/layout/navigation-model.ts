export function isExactPath(pathname: string, href: string): boolean {
  return pathname === href;
}

export function isPathPrefix(pathname: string, href: string): boolean {
  return pathname.startsWith(href);
}

export function isMobileSettingsPath(pathname: string): boolean {
  return pathname.startsWith("/settings/") && !pathname.startsWith("/settings/routines");
}
