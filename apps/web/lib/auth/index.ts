// Barrel for the auth module (sub-project D). Re-exports the public surface
// consumers import via "@/lib/auth".
export { useAuth } from "./useAuth";
export { AuthProvider } from "./AuthProvider";
export type { AuthUser, AuthContextValue } from "./auth-context";
