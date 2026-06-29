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

describe("protected dashboard layout", () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it("redirects to /connect when there is no session", () => {
    useAuthMock.mockReturnValue({ user: null, isLoading: false });
    render(
      <DashboardLayout params={{ accountId: "acc123" }}>
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
      <DashboardLayout params={{ accountId: "acc123" }}>
        <div>secret</div>
      </DashboardLayout>,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText("secret")).toBeInTheDocument();
    expect(screen.getByText("Cluster")).toBeInTheDocument();
  });
});
