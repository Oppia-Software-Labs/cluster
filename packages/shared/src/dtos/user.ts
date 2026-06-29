import { z } from "zod";

/** Input to create/upsert a user (publicKey is the PK). */
export const createUserSchema = z.object({
  publicKey: z.string().min(1),
  displayName: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

/** Read shape returned by the API. */
export const userSchema = z.object({
  publicKey: z.string().min(1),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
export type User = z.infer<typeof userSchema>;
