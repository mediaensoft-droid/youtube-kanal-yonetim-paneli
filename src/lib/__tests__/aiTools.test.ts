import { describe, it, expect } from "vitest";
import { AI_TOOLS, AI_TOOL_CATEGORIES, AI_TOOL_IDS, getAiTool, toolLogoUrl } from "@/lib/aiTools";

describe("aiTools catalog", () => {
  it("has at least 60 tools", () => {
    expect(AI_TOOLS.length).toBeGreaterThanOrEqual(60);
  });

  it("has unique ids", () => {
    const ids = AI_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(AI_TOOL_IDS.size).toBe(ids.length);
  });

  it("every tool's url starts with https://", () => {
    for (const tool of AI_TOOLS) {
      expect(tool.url.startsWith("https://")).toBe(true);
    }
  });

  it("every tool's category exists in AI_TOOL_CATEGORIES", () => {
    const categoryIds = new Set(AI_TOOL_CATEGORIES.map((c) => c.id));
    for (const tool of AI_TOOLS) {
      expect(categoryIds.has(tool.category)).toBe(true);
    }
  });

  it("getAiTool resolves a known id and returns undefined for unknown ids", () => {
    expect(getAiTool("chatgpt")?.name).toBe("ChatGPT");
    expect(getAiTool("does-not-exist")).toBeUndefined();
  });

  it("toolLogoUrl builds a favicon proxy url from the tool's domain", () => {
    const tool = getAiTool("canva")!;
    expect(toolLogoUrl(tool)).toBe(`https://www.google.com/s2/favicons?sz=64&domain=${tool.domain}`);
  });
});
