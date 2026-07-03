import { AxiosError } from "axios";

/**
 * Human-readable message from a failed API call. NestJS puts the useful text in
 * `response.data.message` (string or string[]); everything else falls back to
 * the Error message or a generic string.
 */
export function apiError(e: unknown): string {
  if (e instanceof AxiosError) {
    const msg = e.response?.data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
  }
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}
