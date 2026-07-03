import { describe, it, expect } from "vitest";
import { navRegistry, type NavEntry } from "@/lib/nav";

describe("nav registry", () => {
  it("keeps M1's seed entries first, with member-appended entries after", () => {
    const labels = navRegistry.map((e: NavEntry) => e.label);
    // M1's seed entry stays first (append-only registry)...
    expect(labels[0]).toEqual("Dashboard");
    // ...followed by member-appended entries.
    expect(labels).toContain("Members");
  });

  it("every entry has a label, href and icon", () => {
    for (const entry of navRegistry) {
      expect(entry.label).toBeTruthy();
      expect(entry.href).toMatch(/^\//);
      expect(entry.icon).toBeTruthy();
    }
  });
});
