import { describe, it, expect } from "vitest";
import { navRegistry, type NavEntry } from "@/lib/nav";

describe("nav registry", () => {
  it("starts with M1's own entries (Dashboard, Settings)", () => {
    const labels = navRegistry.map((e: NavEntry) => e.label);
    expect(labels.slice(0, 2)).toEqual(["Dashboard", "Settings"]);
  });

  it("every entry has a label, href and icon", () => {
    for (const entry of navRegistry) {
      expect(entry.label).toBeTruthy();
      expect(entry.href).toMatch(/^\//);
      expect(entry.icon).toBeTruthy();
    }
  });
});
