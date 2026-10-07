/**
 * Cookie utility helpers for managing browser cookies.
 */

export function getCookie(name: string): string | undefined {
  const match = document.cookie.match(
    new RegExp(
      "(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)",
    ),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function setCookie(
  name: string,
  value: string,
  options: { path?: string; maxAge?: number; sameSite?: string } = {},
) {
  const { path = "/", maxAge, sameSite = "Lax" } = options;
  let cookie = `${name}=${encodeURIComponent(value)}; path=${path}; SameSite=${sameSite}`;
  if (maxAge !== undefined) {
    cookie += `; max-age=${maxAge}`;
  }
  document.cookie = cookie;
}

// Cookie consent helpers
const COOKIE_CONSENT_KEY = "cookie_consent";
const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function hasCookieConsent(): boolean {
  return getCookie(COOKIE_CONSENT_KEY) === "accepted";
}

export function acceptCookieConsent() {
  setCookie(COOKIE_CONSENT_KEY, "accepted", { maxAge: COOKIE_CONSENT_MAX_AGE });
}

export function declineCookieConsent() {
  setCookie(COOKIE_CONSENT_KEY, "declined", { maxAge: COOKIE_CONSENT_MAX_AGE });
}

export function hasCookieConsentDecision(): boolean {
  const value = getCookie(COOKIE_CONSENT_KEY);
  return value === "accepted" || value === "declined";
}
