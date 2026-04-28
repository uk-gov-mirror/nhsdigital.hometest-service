import {
  buildPreviewAccessCookie,
  buildPreviewRefreshCookie,
  parsePreviewCookieSameSite,
} from "./cookies";

describe("parsePreviewCookieSameSite", () => {
  it("accepts supported SameSite values", () => {
    expect(parsePreviewCookieSameSite("Strict", true)).toBe("Strict");
    expect(parsePreviewCookieSameSite("Lax", false)).toBe("Lax");
    expect(parsePreviewCookieSameSite("None", true)).toBe("None");
  });

  it("rejects unsupported SameSite values", () => {
    expect(() => parsePreviewCookieSameSite("Invalid", true)).toThrow(
      "AUTH_COOKIE_SAME_SITE must be one of Strict, Lax, or None",
    );
  });

  it("rejects SameSite=None when secure is false", () => {
    expect(() => parsePreviewCookieSameSite("None", false)).toThrow(
      "AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is None",
    );
  });
});

describe("preview cookie builders", () => {
  it("builds the preview access cookie", () => {
    expect(buildPreviewAccessCookie("token", "Lax", false)).toBe(
      "preview_auth=token; HttpOnly; Path=/session-preview; SameSite=Lax;",
    );
  });

  it("builds the preview refresh cookie", () => {
    expect(buildPreviewRefreshCookie("token", "None", true)).toBe(
      "preview_auth_refresh=token; HttpOnly; Path=/session-preview/refresh; SameSite=None; Secure;",
    );
  });
});
