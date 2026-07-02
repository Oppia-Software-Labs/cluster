import { StrKey } from '@stellar/stellar-sdk';
import type { Prisma } from '@prisma/client';

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
