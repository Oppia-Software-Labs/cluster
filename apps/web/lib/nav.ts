import {
  Activity,
  ArrowDownToLine,
  Coins,
  History,
  Image,
  LayoutDashboard,
  Send,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

/**
 * A single sidebar navigation entry.
 * `href` is relative to the dashboard root and is prefixed with the
 * active accountId by the nav renderer.
 */
export type NavEntry = {
  /** Visible label in the sidebar. */
  label: string;
  /** Account-relative path, e.g. "/" or "/settings". */
  href: string;
  /** Lucide icon rendered before the label. */
  icon: LucideIcon;
};

/**
 * APPEND-ONLY nav registry.
 *
 * Seeded ONLY with Member 1's own entries (Dashboard, Settings).
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ OTHER MEMBERS: APPEND your entry to the END of this array.   │
 * │ Do NOT reorder, edit, or remove existing entries. Do NOT     │
 * │ rewrite the shell. One entry per feature, owned by you.      │
 * │   M2 (accounts/members/threshold) · M3 (assets) · M4 (trade) │
 * └─────────────────────────────────────────────────────────────┘
 */
export const navRegistry: NavEntry[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Settings", href: "/settings", icon: Settings },
  // ↓ other members append below this line ↓
  { label: "Send", href: "/send", icon: Send },
  { label: "Deposit", href: "/deposit", icon: ArrowDownToLine },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "History", href: "/history", icon: History },
  { label: "Coins", href: "/coins", icon: Coins },
  { label: "NFTs", href: "/nfts", icon: Image },
  { label: "Cashflow", href: "/cashflow", icon: TrendingUp },
];
