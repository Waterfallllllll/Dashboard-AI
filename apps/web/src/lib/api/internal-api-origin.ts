export function internalApiOrigin(value: string | undefined): string {
  const raw = value?.trim() || "http://localhost:4000";
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("INTERNAL_API_URL должен быть адресом API");
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new Error("INTERNAL_API_URL должен быть адресом API без пути и параметров");
  }

  return url.origin;
}
