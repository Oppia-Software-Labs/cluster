// Minimal ambient types for the browser build of `qrcode` (ships no types).
declare module "qrcode" {
  export interface ToDataURLOptions {
    margin?: number;
    width?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }
  export function toDataURL(
    text: string,
    options?: ToDataURLOptions,
  ): Promise<string>;
  const _default: { toDataURL: typeof toDataURL };
  export default _default;
}
