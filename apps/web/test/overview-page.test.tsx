import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import OverviewPage from "@/app/(dashboard)/[accountId]/page";

describe("overview page scaffold", () => {
  it("renders labeled slots for the data widgets owned by other members", () => {
    render(<OverviewPage />);
    expect(screen.getByText("Total Balance")).toBeInTheDocument();
    expect(screen.getByTestId("slot-balance-chart")).toBeInTheDocument();
    expect(screen.getByTestId("slot-stat-cards")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Coins" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "NFTs" })).toBeInTheDocument();
  });
});
