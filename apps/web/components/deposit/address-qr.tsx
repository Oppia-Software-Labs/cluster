"use client";

import { useEffect, useState } from "react";

/**
 * Renders a QR of the deposit address. Generates the data URL on the client via
 * the `qrcode` browser build; if generation fails it renders nothing so the
 * copyable address remains the source of truth.
 */
export function AddressQr({ value, size = 176 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(value, {
          margin: 1,
          width: size * 2,
          color: { dark: "#0a0a0a", light: "#fafafa" },
          errorCorrectionLevel: "M",
        }),
      )
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [value, size]);

  return (
    <div
      className="grid place-items-center rounded-2xl border border-[var(--hairline)] bg-[#fafafa] p-2"
      style={{ width: size + 24, height: size + 24 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Deposit address QR code"
          width={size}
          height={size}
          className="rounded-lg"
        />
      ) : (
        <div className="size-full animate-pulse rounded-lg bg-[#0a0a0a]/10" />
      )}
    </div>
  );
}
