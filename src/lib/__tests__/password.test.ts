import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("verifies the original and rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).not.toBe("correct horse");
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
