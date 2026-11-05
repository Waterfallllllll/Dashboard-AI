const FALLBACK_MESSAGE = {
  title: "Evergreen",
  body: "Есть новое уведомление.",
  path: "/dashboard",
  tag: "evergreen"
};

export function safeNotificationPath(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 200) {
    return FALLBACK_MESSAGE.path;
  }

  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("://") ||
    value.includes("%00")
  ) {
    return FALLBACK_MESSAGE.path;
  }

  return value;
}

export function parsePushMessage(value) {
  if (typeof value !== "object" || value === null) {
    return FALLBACK_MESSAGE;
  }

  const record = value;
  const title = cleanText(record.title, 120);
  const body = cleanText(record.body, 240);
  const tag = cleanText(record.tag, 64);

  return {
    title: title || FALLBACK_MESSAGE.title,
    body: body || FALLBACK_MESSAGE.body,
    path: safeNotificationPath(record.path),
    tag: tag || FALLBACK_MESSAGE.tag
  };
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  let result = "";

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;

    if (code === 9 || code === 10 || code === 13) {
      result += " ";
      continue;
    }

    if (code > 31 && code !== 127) {
      result += character;
    }
  }

  return result.replaceAll(/\s+/g, " ").trim().slice(0, maxLength);
}
