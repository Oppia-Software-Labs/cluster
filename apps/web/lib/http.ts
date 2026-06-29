import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Pre-configured axios instance for the NestJS API.
 * Prefixes the configured API base URL and sends/parses JSON.
 * Non-2xx responses reject, so TanStack Query surfaces them as errors.
 */
export const http = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});
