import { GOOGLE_AUTHORIZATION_HOST } from "../../config/constants.js";

const CALLBACK_PARAMS = ["code", "state", "error", "error_description", "iss", "scope"] as const;

export function googleCallbackUrl(redirectUri: string, query: URLSearchParams): URL {
  const url = new URL(redirectUri);

  for (const key of CALLBACK_PARAMS) {
    const value = query.get(key);

    if (value !== null && value.length > 0 && value.length <= 2048) {
      url.searchParams.set(key, value);
    }
  }

  return url;
}

export function assertGoogleAuthorizationUrl(value: string): void {
  const url = new URL(value);

  if (url.protocol !== "https:" || url.hostname !== GOOGLE_AUTHORIZATION_HOST) {
    throw new Error("Неожиданный адрес авторизации Google");
  }
}

export function queryParams(query: RequestQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of CALLBACK_PARAMS) {
    const value = query[key];

    if (typeof value === "string") {
      params.set(key, value);
    }
  }

  return params;
}

type RequestQuery = Record<string, unknown>;
