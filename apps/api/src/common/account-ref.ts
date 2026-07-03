import { NotFoundException } from '@nestjs/common';
import { StrKey } from '@stellar/stellar-sdk';
import type { Prisma } from '@prisma/client';
import { getStellarNetwork } from '@cluster/stellar';

/**
 * Account route params accept either the internal cuid or the account's
 * Stellar address (G…, unique in the schema). The web app links by address so
 * URLs are meaningful; older links by id keep working. Services must use the
 * RESOLVED row's `id` for relations — never the raw param.
 */
export function accountWhere(
  ref: string,
): Prisma.MultisigAccountWhereUniqueInput {
  return StrKey.isValidEd25519PublicKey(ref)
    ? { stellarAccountId: ref }
    : { id: ref };
}

/**
 * Accounts are scoped to the network they were created on. An account from
 * the OTHER network must be invisible on this deployment — same 404 as a
 * nonexistent account, so its existence isn't leaked — because its
 * transactions would target a chain this deployment isn't configured for.
 * Call after every account load; lists filter with `network: getStellarNetwork()`.
 */
export function assertActiveNetwork(account: { network: string }): void {
  if (account.network !== getStellarNetwork()) {
    throw new NotFoundException('Account not found');
  }
}
