"use client";

import { useCallback, useEffect, useState } from "react";
import { http } from "../http";
import { getWalletKit } from "./wallet-kit";
import { AuthContext, type AuthContextValue, type AuthUser } from "./auth-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  // Hydrate session from the httpOnly cookie on mount.
  useEffect(() => {
    let active = true;
    http
      .get<AuthUser>("/auth/me")
      .then((res) => {
        if (active) {
          setUser(res.data);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        if (active) setStatus("idle");
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async () => {
    setError(null);
    try {
      const kit = await getWalletKit();
      setStatus("connecting");
      // Open the wallet selection modal; resolves with the chosen wallet's
      // address once the user picks a wallet and grants access.
      const { address } = await kit.authModal();
      if (!address) {
        setStatus("idle");
        return;
      }

      setStatus("authenticating");
      const challenge = await http.get<{ message: string; nonce: string }>(
        "/auth/challenge",
        { params: { publicKey: address } },
      );

      let signedMessage: string;
      try {
        const signed = await kit.signMessage(challenge.data.message, { address });
        signedMessage = signed.signedMessage;
      } catch {
        throw new Error(
          "This wallet does not support message signing. Use Freighter or another SEP-53 capable wallet.",
        );
      }

      const verified = await http.post<AuthUser>("/auth/verify", {
        publicKey: address,
        signature: signedMessage,
        nonce: challenge.data.nonce,
      });
      setUser(verified.data);
      setStatus("authenticated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
      setStatus("error");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await http.post("/auth/logout");
    } finally {
      setUser(null);
      setStatus("idle");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, status, isLoading: status === "loading", error, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
