import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/acc123",
}));

describe("shell smoke render", () => {
  it("renders the sidebar brand and nav", () => {
    render(<Sidebar accountId="acc123" />);
    expect(screen.getByText("Cluster")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders the topbar network status and wallet chip", () => {
    render(<Topbar publicKey="GABCDEFGHIJKLMNOPQRSTUVWXYZ234567" />);
    expect(screen.getByText(/Network Status/i)).toBeInTheDocument();
    // truncated pubkey shows head…tail
    expect(screen.getByText(/GABC.*4567/)).toBeInTheDocument();
  });
});
