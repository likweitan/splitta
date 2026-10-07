import { useEffect, useState } from "react";

async function sha256Hex(str: string): Promise<string> {
  const encoded = new TextEncoder().encode(str.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Returns a Gravatar URL for the given email address.
 * Falls back to `fallback` while the hash is being computed or if email is empty.
 * Uses the SHA-256 endpoint (Gravatar's newer format) so no external MD5 library is needed.
 * `d=mp` shows the "mystery person" silhouette when no Gravatar is found.
 */
export function useGravatar(email: string, size = 80): string {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!email) return;

    sha256Hex(email).then((hash) => {
      setUrl(`https://gravatar.com/avatar/${hash}?d=mp&s=${size}`);
    });
  }, [email, size]);

  return url;
}
