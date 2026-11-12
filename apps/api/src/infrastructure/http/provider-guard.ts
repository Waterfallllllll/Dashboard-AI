const DEFAULT_ATTEMPTS = 2;
const DEFAULT_MAX_BYTES = 1_000_000;

export class ProviderUnavailableError extends Error {
  readonly provider: string;
  readonly permanent: boolean;

  constructor(provider: string, permanent = false) {
    super("Внешний сервис временно недоступен");
    this.name = "ProviderUnavailableError";
    this.provider = provider;
    this.permanent = permanent;
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly threshold = 5,
    private readonly openMs = 30_000,
    private readonly now: () => number = () => Date.now()
  ) {}

  assertClosed(provider: string): void {
    if (this.failures < this.threshold) {
      return;
    }

    if (this.now() - this.openedAt >= this.openMs) {
      return;
    }

    throw new ProviderUnavailableError(provider);
  }

  succeed(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  fail(): void {
    this.failures += 1;

    if (this.failures >= this.threshold) {
      this.openedAt = this.now();
    }
  }
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export async function fetchAllowlisted(input: {
  readonly url: URL;
  readonly allowHosts: readonly string[];
  readonly provider: string;
  readonly fetchImpl: FetchLike;
  readonly breaker: CircuitBreaker;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly maxBytes?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly sleep?: (ms: number) => Promise<void>;
}): Promise<string> {
  assertAllowedUrl(input.url, input.allowHosts, input.provider);
  input.breaker.assertClosed(input.provider);
  const attempts = input.maxAttempts ?? DEFAULT_ATTEMPTS;
  const sleep = input.sleep ?? delay;
  let lastError: ProviderUnavailableError | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const body = await readOnce(input);
      input.breaker.succeed();
      return body;
    } catch (error) {
      lastError =
        error instanceof ProviderUnavailableError
          ? error
          : new ProviderUnavailableError(input.provider);
      const retry = attempt < attempts && error instanceof TransientProviderError;

      if (!retry) {
        input.breaker.fail();
        throw lastError;
      }

      await sleep(100 * 2 ** (attempt - 1));
    }
  }

  input.breaker.fail();
  throw lastError ?? new ProviderUnavailableError(input.provider);
}

export function assertAllowedUrl(url: URL, allowHosts: readonly string[], provider: string): void {
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    !allowHosts.includes(url.hostname)
  ) {
    throw new ProviderUnavailableError(provider);
  }
}

class TransientProviderError extends ProviderUnavailableError {}

async function readOnce(input: {
  readonly url: URL;
  readonly provider: string;
  readonly fetchImpl: FetchLike;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  readonly headers?: Readonly<Record<string, string>>;
}): Promise<string> {
  let response: Response;

  try {
    response = await input.fetchImpl(input.url.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(input.timeoutMs ?? 3000),
      headers: {
        accept: "application/json, application/xml, text/xml, */*;q=0.1",
        "user-agent": "EvergreenDashboard/0.1",
        ...input.headers
      }
    });
  } catch {
    throw new TransientProviderError(input.provider);
  }

  if (response.status === 429 || response.status >= 500) {
    await response.body?.cancel();
    throw new TransientProviderError(input.provider);
  }

  if (response.status < 200 || response.status >= 300) {
    await response.body?.cancel();
    throw new ProviderUnavailableError(input.provider);
  }

  return readLimited(response, input.maxBytes ?? DEFAULT_MAX_BYTES, input.provider);
}

async function readLimited(
  response: Response,
  maxBytes: number,
  provider: string
): Promise<string> {
  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const parts: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const step = await reader.read();

      if (step.done) {
        break;
      }

      if (!step.value) {
        continue;
      }

      total += step.value.byteLength;

      if (total > maxBytes) {
        await reader.cancel();
        throw new ProviderUnavailableError(provider);
      }

      parts.push(step.value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    merged.set(part, offset);
    offset += part.byteLength;
  }

  return new TextDecoder().decode(merged);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
