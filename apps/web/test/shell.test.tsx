import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

// The account switcher (Member 2) reads the route and navigates on select, so
// the shell now needs usePathname + useRouter.
vi.mock("next/navigation", () => ({
  usePathname: () => "/acc123",
  useRouter: () => ({ push: vi.fn() }),
}));

// The switcher fetches accounts via TanStack Query; provide a client so the
// sidebar smoke-renders (the query stays pending in the test).
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("shell smoke render", () => {
  it("renders the sidebar brand and nav", () => {
    renderWithClient(<Sidebar accountId="acc123" />);
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
