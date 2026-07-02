import { z } from "zod";
import { memberRoleSchema } from "../enums";

/**
 * The off-chain effect a proposed `config` transaction will have once it is
 * signed and submitted on-chain. Stored alongside the transaction at propose
 * time and applied to the roster/thresholds ONLY after successful submission,
 * so Cluster's records never claim signing power the chain doesn't enforce
 * yet (e.g. a newly added signer must not count toward thresholds — nor sign —
 * before the set_options that adds them has executed).
 */
export const configChangeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("member.add"),
    publicKey: z.string().min(1),
    weight: z.number().int().positive(),
    role: memberRoleSchema,
  }),
  z.object({
    kind: z.literal("member.remove"),
    publicKey: z.string().min(1),
  }),
  z.object({
    kind: z.literal("thresholds.set"),
    low: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
  }),
]);
export type ConfigChange = z.infer<typeof configChangeSchema>;
