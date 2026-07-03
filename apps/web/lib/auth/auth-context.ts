import { createContext } from "react";

export type AuthUser = { publicKey: string } & Record<string, unknown>;

export type AuthContextValue = {
  user: AuthUser | null;
  // starts at "loading" during the initial /auth/me hydration so consumers
  // never treat an un-hydrated session as logged-out.
  status: "loading" | "idle" | "connecting" | "authenticating" | "authenticated" | "error";
  // derived: true only while the initial session hydration is in flight.
  // Consumed by sub-project E's protected layout (`const { user, isLoading } = useAuth()`).
  isLoading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
