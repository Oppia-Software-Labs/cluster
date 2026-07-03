import { z } from "zod";
import { confidentialOpSchema, confidentialRegStatusSchema } from "../enums";

/** Re-exported so confidential DTO consumers can reach the op enum from one barrel. */
export { confidentialOpSchema };
export type { ConfidentialOp } from "../enums";

/** Client-supplied wrap public key used to seal per-member key material. */
export const wrapKeySchema = z.object({
  wrapPublicKey: z.string().min(1),
});
export type WrapKeyDto = z.infer<typeof wrapKeySchema>;

/** Persisted wrap key returned to clients (owner + public material only). */
export const wrapKeyResponseSchema = z.object({
  userPublicKey: z.string(),
  wrapPublicKey: z.string(),
});
export type WrapKeyResponse = z.infer<typeof wrapKeyResponseSchema>;

/** A single member's sealed copy of a shared secret. */
export const keyEnvelopeSchema = z.object({
  memberPublicKey: z.string(),
  ciphertext: z.string(),
});
export type KeyEnvelopeDto = z.infer<typeof keyEnvelopeSchema>;

/** Persisted envelope returned to clients (ciphertext is opaque to the server). */
export const keyEnvelopeResponseSchema = z.object({
  accountId: z.string(),
  memberPublicKey: z.string(),
  ciphertext: z.string(),
});
export type KeyEnvelopeResponse = z.infer<typeof keyEnvelopeResponseSchema>;

/** Encrypted opening data keyed by the event it decrypts. */
export const openingBlobSchema = z.object({
  eventKey: z.string(),
  ciphertext: z.string(),
});
export type OpeningBlobDto = z.infer<typeof openingBlobSchema>;

/** Persisted opening returned to clients (ciphertext is opaque to the server). */
export const openingBlobResponseSchema = z.object({
  accountId: z.string(),
  eventKey: z.string(),
  ciphertext: z.string(),
});
export type OpeningBlobResponse = z.infer<typeof openingBlobResponseSchema>;

/** Confidential-token registration parameters for an account. */
export const confidentialRegistrationSchema = z.object({
  tokenContract: z.string().min(1),
  auditorId: z.number().int().nonnegative(),
  spendingPubKey: z.string().min(1),
});
export type ConfidentialRegistrationDto = z.infer<
  typeof confidentialRegistrationSchema
>;

/** PATCH registration — advance status after the on-chain event is observed. */
export const advanceRegistrationSchema = z.object({
  status: confidentialRegStatusSchema,
});
export type AdvanceRegistrationDto = z.infer<typeof advanceRegistrationSchema>;

/** Persisted registration returned to clients. */
export const registrationResponseSchema = z.object({
  accountId: z.string(),
  tokenContract: z.string(),
  auditorId: z.number().int(),
  status: confidentialRegStatusSchema,
  spendingPubKey: z.string(),
});
export type RegistrationResponse = z.infer<typeof registrationResponseSchema>;
