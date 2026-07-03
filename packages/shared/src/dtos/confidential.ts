import { z } from "zod";
import { confidentialOpSchema } from "../enums";

/** Re-exported so confidential DTO consumers can reach the op enum from one barrel. */
export { confidentialOpSchema };
export type { ConfidentialOp } from "../enums";

/** Client-supplied wrap public key used to seal per-member key material. */
export const wrapKeySchema = z.object({
  wrapPublicKey: z.string().min(1),
});
export type WrapKeyDto = z.infer<typeof wrapKeySchema>;

/** A single member's sealed copy of a shared secret. */
export const keyEnvelopeSchema = z.object({
  memberPublicKey: z.string(),
  ciphertext: z.string(),
});
export type KeyEnvelopeDto = z.infer<typeof keyEnvelopeSchema>;

/** Encrypted opening data keyed by the event it decrypts. */
export const openingBlobSchema = z.object({
  eventKey: z.string(),
  ciphertext: z.string(),
});
export type OpeningBlobDto = z.infer<typeof openingBlobSchema>;

/** Confidential-token registration parameters for an account. */
export const confidentialRegistrationSchema = z.object({
  tokenContract: z.string().min(1),
  auditorId: z.number().int().nonnegative(),
  spendingPubKey: z.string().min(1),
});
export type ConfidentialRegistrationDto = z.infer<
  typeof confidentialRegistrationSchema
>;
