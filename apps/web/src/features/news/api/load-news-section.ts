import {
  SECTION_ERROR_MESSAGE,
  apiSuccessSchema,
  newsSectionSchema,
  type NewsSection
} from "@dashboard/contracts";

const newsSectionResponseSchema = apiSuccessSchema(newsSectionSchema);

export async function loadNewsSection(
  options: Readonly<{ refresh?: boolean }> = {},
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal
): Promise<NewsSection> {
  const query = options.refresh === true ? "?refresh=1" : "";

  try {
    const response = await fetchImpl(`/api/v1/news${query}`, {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      ...(signal ? { signal } : {})
    });

    if (!response.ok) {
      return { status: "error", message: SECTION_ERROR_MESSAGE };
    }

    const parsed = newsSectionResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.data : { status: "error", message: SECTION_ERROR_MESSAGE };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    return { status: "error", message: SECTION_ERROR_MESSAGE };
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
