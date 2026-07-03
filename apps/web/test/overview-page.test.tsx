import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";

import OverviewPage from "@/app/(dashboard)/[accountId]/page";

// The overview page reads account data via TanStack Query, so it needs a client.
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Suspense fallback={null}>{ui}</Suspense>
    </QueryClientProvider>,
  );
}

describe("overview page scaffold", () => {
  it("renders data widgets and tabs for the Treasury overview", async () => {
    await act(async () => {
      renderWithClient(
        <OverviewPage params={Promise.resolve({ accountId: "acc1" })} />,
      );
    });
    expect(await screen.findByText("Total balance")).toBeInTheDocument();
    expect(await screen.findByTestId("slot-balance-chart")).toBeInTheDocument();
    expect(await screen.findByTestId("slot-stat-cards")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Coins" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "NFTs" })).toBeInTheDocument();
  });
});
