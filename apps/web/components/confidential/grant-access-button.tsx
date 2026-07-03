"use client";

import { useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";

import { Button } from "@cluster/ui";
import { bytesToHex, hexToBytes, sealSecret } from "@cluster/zk";

import { apiError } from "@/lib/api-error";
import {
  useConfidentialSession,
  usePutKeyEnvelope,
  useWrapKey,
} from "@/lib/confidential";

/**
 * Grant a roster member access to the account's confidential secret.
 *
 * Re-sealing happens entirely client-side — the account secret never leaves
 * the browser; the server stores only the new member's ciphertext envelope.
 */
export function GrantAccessButton({
  accountId,
  memberPublicKey,
}: {
  accountId: string;
  memberPublicKey: string;
}) {
  const session = useConfidentialSession(accountId);
  const { data: wrapKey } = useWrapKey(memberPublicKey);
  const putEnvelope = usePutKeyEnvelope(accountId);
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session.status !== "unlocked" || session.sk === null) {
    return (
      <Button size="sm" variant="outline" disabled>
        Unlock first
      </Button>
    );
  }

  if (!wrapKey) {
    return (
      <Button size="sm" variant="outline" disabled>
        Awaiting their key
      </Button>
    );
  }

  if (granted) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Check className="size-4 text-[var(--signal)]" />
        Access granted
      </Button>
    );
  }

  async function grant() {
    if (session.sk === null) return;
    setError(null);
    try {
      const ciphertext = bytesToHex(
        sealSecret(session.sk, hexToBytes(wrapKey!.wrapPublicKey)),
      );
      await putEnvelope.mutateAsync({ memberPublicKey, ciphertext });
      setGranted(true);
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={putEnvelope.isPending}
        onClick={grant}
        className="border-[var(--hairline)] bg-transparent hover:bg-[var(--surface-2)]"
      >
        {putEnvelope.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Granting…
          </>
        ) : (
          <>
            <KeyRound className="size-4" /> Grant access
          </>
        )}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
