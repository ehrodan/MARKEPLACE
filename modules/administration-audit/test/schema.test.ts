import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { auditEvents } from "../src/index.js";

describe("audit schema", () => {
  it("mantém a tabela canônica append-only", () => {
    expect(getTableName(auditEvents)).toBe("audit_events");
  });
});
