import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";

import OverviewPage from "@/app/(dashboard)/[accountId]/page";

// The Accounts tab now renders AccountsList (Member 2), which reads accounts via
// TanStack Query, so the page needs a QueryClient to render.
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("overview page scaffold", () => {
  it("renders labeled slots for the data widgets owned by other members", () => {
    renderWithClient(<OverviewPage />);
    expect(screen.getByText("Total Balance")).toBeInTheDocument();
    expect(screen.getByTestId("slot-balance-chart")).toBeInTheDocument();
    expect(screen.getByTestId("slot-stat-cards")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Coins" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "NFTs" })).toBeInTheDocument();
  });
});
