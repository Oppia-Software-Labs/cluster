import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/acc123",
  useRouter: () => ({ replace }),
}));

const useAuthMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => useAuthMock(),
}));

import DashboardLayout from "@/app/(dashboard)/[accountId]/layout";

// Next 15 types route `params` as a Promise. The layout's runtime guard also
// accepts a plain object (it only calls `use()` when given an actual Promise),
// so we pass a plain object cast to the declared type to keep the render
// synchronous (no Suspense) while satisfying the type checker.
function makeParams(accountId: string): Promise<{ accountId: string }> {
  return { accountId } as unknown as Promise<{ accountId: string }>;
}

describe("protected dashboard layout", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("redirects to /connect when there is no session", () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false });
    render(
      <DashboardLayout params={makeParams("acc123")}>
        <div>secret</div>
      </DashboardLayout>,
    );
    expect(replace).toHaveBeenCalledWith("/connect");
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders the shell and children when authenticated", () => {
    useAuthMock.mockReturnValue({
      user: { publicKey: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567" },
      isLoading: false,
    });
    render(
      <DashboardLayout params={makeParams("acc123")}>
        <div>secret</div>
      </DashboardLayout>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(screen.getByText("Cluster")).toBeInTheDocument();
  });
});
