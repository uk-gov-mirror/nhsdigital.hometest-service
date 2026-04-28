export const PREVIEW_SESSION_ACCESS_COOKIE_NAME = "preview_auth";
export const PREVIEW_SESSION_REFRESH_COOKIE_NAME = "preview_auth_refresh";
export const PREVIEW_SESSION_ACCESS_COOKIE_PATH = "/session-preview";
export const PREVIEW_SESSION_REFRESH_COOKIE_PATH = "/session-preview/refresh";

export type PreviewCookieSameSite = "Strict" | "Lax" | "None";

export function parsePreviewCookieSameSite(
  sameSite: string,
  secure: boolean,
): PreviewCookieSameSite {
  const trimmedSameSite = sameSite.trim();

  switch (trimmedSameSite) {
    case "Strict":
    case "Lax":
      return trimmedSameSite;
    case "None":
      if (!secure) {
        throw new Error("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is None");
      }
      return trimmedSameSite;
    default:
      throw new Error("AUTH_COOKIE_SAME_SITE must be one of Strict, Lax, or None");
  }
}

function secureAttribute(secure: boolean): string {
  return secure ? " Secure;" : "";
}

export function buildPreviewAccessCookie(
  token: string,
  sameSite: PreviewCookieSameSite,
  secure: boolean,
): string {
  return `${PREVIEW_SESSION_ACCESS_COOKIE_NAME}=${token}; HttpOnly; Path=${PREVIEW_SESSION_ACCESS_COOKIE_PATH}; SameSite=${sameSite};${secureAttribute(secure)}`;
}

export function buildPreviewRefreshCookie(
  token: string,
  sameSite: PreviewCookieSameSite,
  secure: boolean,
): string {
  return `${PREVIEW_SESSION_REFRESH_COOKIE_NAME}=${token}; HttpOnly; Path=${PREVIEW_SESSION_REFRESH_COOKIE_PATH}; SameSite=${sameSite};${secureAttribute(secure)}`;
}
