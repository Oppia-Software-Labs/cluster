import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NavList } from "@/components/shell/nav-list";
import { navRegistry } from "@/lib/nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/acc123",
}));

describe("NavList", () => {
  it("renders exactly the registered nav entries", () => {
    render(<NavList accountId="acc123" />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(navRegistry.length);
    for (const entry of navRegistry) {
      expect(screen.getByText(entry.label)).toBeInTheDocument();
    }
  });

  it("prefixes hrefs with the accountId", () => {
    render(<NavList accountId="acc123" />);
    expect(screen.getByText("Settings").closest("a")).toHaveAttribute(
      "href",
      "/acc123/settings",
    );
  });
});
