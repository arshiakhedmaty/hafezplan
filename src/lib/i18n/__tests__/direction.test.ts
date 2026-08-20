import { describe, expect, it } from "vitest";
import { applyLanguageToRoot, languageAttributes, resolveLanguage } from "../index";

describe("language direction", () => {
  it("maps Persian to RTL and English to LTR", () => {
    expect(languageAttributes("fa")).toEqual({ lang: "fa", dir: "rtl" });
    expect(languageAttributes("en")).toEqual({ lang: "en", dir: "ltr" });
  });

  it("safely restores a persisted language", () => {
    expect(resolveLanguage("en")).toBe("en");
    expect(resolveLanguage("fa")).toBe("fa");
    expect(resolveLanguage("unexpected")).toBe("fa");
    expect(resolveLanguage(null)).toBe("fa");
  });

  it("survives repeated direction switches without stale attributes", () => {
    const root = { lang: "", dir: "" };
    for (const language of ["fa", "en", "fa", "en", "fa"] as const) {
      applyLanguageToRoot(root, language);
      expect(root).toEqual(languageAttributes(language));
    }
  });
});
