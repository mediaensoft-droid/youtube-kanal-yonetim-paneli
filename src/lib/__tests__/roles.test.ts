import { describe, it, expect } from "vitest";
import { can, isMemberRole, STAFF_ROLES } from "@/lib/roles";

describe("can()", () => {
  it("yonetici can do everything", () => {
    for (const p of [
      "channel.write",
      "channel.delete",
      "taxonomy.write",
      "schedule.write",
      "team.manage",
      "billing.view",
      "task.write",
      "task.delete",
      "files.write",
      "files.delete",
    ] as const) {
      expect(can("yonetici", p)).toBe(true);
    }
  });
  it("vekil: everything except team/billing", () => {
    expect(can("vekil", "channel.delete")).toBe(true);
    expect(can("vekil", "team.manage")).toBe(false);
    expect(can("vekil", "billing.view")).toBe(false);
    expect(can("vekil", "task.write")).toBe(true);
    expect(can("vekil", "task.delete")).toBe(true);
    expect(can("vekil", "files.write")).toBe(true);
    expect(can("vekil", "files.delete")).toBe(true);
  });
  it("duzenleyici: writes but no delete", () => {
    expect(can("duzenleyici", "channel.write")).toBe(true);
    expect(can("duzenleyici", "schedule.write")).toBe(true);
    expect(can("duzenleyici", "channel.delete")).toBe(false);
    expect(can("duzenleyici", "task.write")).toBe(true);
    expect(can("duzenleyici", "task.delete")).toBe(false);
    expect(can("duzenleyici", "files.write")).toBe(true);
    expect(can("duzenleyici", "files.delete")).toBe(false);
  });
  it("goruntuleyici: read-only", () => {
    expect(can("goruntuleyici", "channel.write")).toBe(false);
    expect(can("goruntuleyici", "taxonomy.write")).toBe(false);
    expect(can("goruntuleyici", "schedule.write")).toBe(false);
    expect(can("goruntuleyici", "task.write")).toBe(false);
    expect(can("goruntuleyici", "task.delete")).toBe(false);
    expect(can("goruntuleyici", "files.write")).toBe(false);
    expect(can("goruntuleyici", "files.delete")).toBe(false);
  });
  it("role guard", () => {
    expect(isMemberRole("vekil")).toBe(true);
    expect(isMemberRole("admin")).toBe(false);
    expect(STAFF_ROLES).not.toContain("yonetici");
  });
});
