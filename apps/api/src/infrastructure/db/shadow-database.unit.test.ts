import { describe, expect, it } from "vitest";

import { shadowDatabaseUrl } from "./shadow-database.js";

const directUrl = "postgresql://dashboard:dashboard@localhost:5432/dashboard";

describe("shadow-база Prisma", () => {
  it("берёт ту же учётную запись и отдельное имя базы", () => {
    expect(shadowDatabaseUrl(directUrl, {})).toBe(
      "postgresql://dashboard:dashboard@localhost:5432/dashboard_shadow"
    );
  });

  it("сохраняет явный адрес из окружения", () => {
    const configured = "postgresql://dashboard:dashboard@localhost:5432/custom_shadow";

    expect(shadowDatabaseUrl(directUrl, { SHADOW_DATABASE_URL: ` ${configured} ` })).toBe(
      configured
    );
  });
});
