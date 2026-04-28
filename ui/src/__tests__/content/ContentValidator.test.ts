import {
  assertValidPrivacyPolicyContent,
  assertValidTermsOfUseContent,
  validateContent,
} from "@/content";

const validCommonContent = {
  navigation: { back: "Back", continue: "Continue" },
  validation: {},
  links: {},
  errorSummary: {},
  orderStatus: {},
  feedback: {},
  footer: {},
};

const minimalPage = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: "Test page",
  pageTitle: "Test page – HIV Home Test Service – NHS",
  ...overrides,
});

const buildValidPages = (): Record<string, unknown> => ({
  "before-you-start": minimalPage(),
  "get-self-test-kit-for-HIV": minimalPage(),
  "kit-not-available-in-area": minimalPage(),
  "go-to-clinic": minimalPage(),
  "enter-delivery-address": minimalPage(),
  "enter-address-manually": minimalPage(),
  "no-address-found": minimalPage(),
  "select-delivery-address": minimalPage(),
  "how-comfortable-pricking-finger": minimalPage(),
  "cannot-use-service-under-18": minimalPage(),
  "enter-mobile-phone-number": minimalPage(),
  "check-your-answers": minimalPage(),
  "confirm-mobile-phone-number": minimalPage(),
  "service-error": minimalPage(),
  "order-tracking": minimalPage(),
  "test-results": minimalPage(),
  "blood-sample-guide": minimalPage(),
  "order-submitted": minimalPage(),
  "suppliers-terms-conditions": { title: "Supplier terms", suppliers: {} },
  "suppliers-privacy-policy": { title: "Supplier privacy", suppliers: {} },
});

describe("ContentValidator", () => {
  describe("validateContent – pageTitle on main pages", () => {
    it("returns valid when all pages have pageTitle", () => {
      const result = validateContent({
        commonContent: validCommonContent,
        pages: buildValidPages(),
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns an error when a main page is missing pageTitle", () => {
      const pages = buildValidPages();
      const page = pages["before-you-start"] as Record<string, unknown>;
      delete page["pageTitle"];

      const result = validateContent({
        commonContent: validCommonContent,
        pages,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "pages.before-you-start.pageTitle must be a non-empty string",
      );
    });

    it("returns an error when a main page has a blank pageTitle", () => {
      const pages = buildValidPages();
      (pages["enter-delivery-address"] as Record<string, unknown>)["pageTitle"] = "   ";

      const result = validateContent({
        commonContent: validCommonContent,
        pages,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "pages.enter-delivery-address.pageTitle must be a non-empty string",
      );
    });

    it.each(["check-your-answers", "confirm-mobile-phone-number", "order-submitted"] as const)(
      "validates pageTitle for %s",
      (key) => {
        const pages = buildValidPages();
        delete (pages[key] as Record<string, unknown>)["pageTitle"];

        const result = validateContent({
          commonContent: validCommonContent,
          pages,
        });

        expect(result.errors).toContain(`pages.${key}.pageTitle must be a non-empty string`);
      },
    );

    it("does not require pageTitle on supplier pages", () => {
      const result = validateContent({
        commonContent: validCommonContent,
        pages: buildValidPages(),
      });

      expect(result.errors.some((e) => e.includes("suppliers-terms-conditions.pageTitle"))).toBe(
        false,
      );
      expect(result.errors.some((e) => e.includes("suppliers-privacy-policy.pageTitle"))).toBe(
        false,
      );
    });

    it("returns an error when order-submitted page is missing", () => {
      const pages = buildValidPages();
      delete pages["order-submitted"];

      const result = validateContent({
        commonContent: validCommonContent,
        pages,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("pages is missing required key: order-submitted");
    });
  });

  describe("assertValidPrivacyPolicyContent", () => {
    const validPrivacyPolicy = {
      pageTitle: "Home test privacy policy – HIV Home Test Service – NHS",
      title: "Privacy Policy",
      introduction: [],
      sections: [],
    };

    it("does not throw when pageTitle is present", () => {
      expect(() => assertValidPrivacyPolicyContent(validPrivacyPolicy)).not.toThrow();
    });

    it("throws when pageTitle is missing", () => {
      const withoutPageTitle = Object.fromEntries(
        Object.entries(validPrivacyPolicy).filter(([k]) => k !== "pageTitle"),
      );

      expect(() => assertValidPrivacyPolicyContent(withoutPageTitle)).toThrow(
        "pageTitle must be a non-empty string",
      );
    });

    it("throws when pageTitle is blank", () => {
      expect(() =>
        assertValidPrivacyPolicyContent({ ...validPrivacyPolicy, pageTitle: "   " }),
      ).toThrow("pageTitle must be a non-empty string");
    });
  });

  describe("assertValidTermsOfUseContent", () => {
    const validTerms = {
      pageTitle: "Home test terms of use – HIV Home Test Service – NHS",
      title: "Terms of Use",
      introduction: [],
      sections: [],
    };

    it("does not throw when pageTitle is present", () => {
      expect(() => assertValidTermsOfUseContent(validTerms)).not.toThrow();
    });

    it("throws when pageTitle is missing", () => {
      const withoutPageTitle = Object.fromEntries(
        Object.entries(validTerms).filter(([k]) => k !== "pageTitle"),
      );

      expect(() => assertValidTermsOfUseContent(withoutPageTitle)).toThrow(
        "pageTitle must be a non-empty string",
      );
    });

    it("throws when pageTitle is blank", () => {
      expect(() => assertValidTermsOfUseContent({ ...validTerms, pageTitle: "" })).toThrow(
        "pageTitle must be a non-empty string",
      );
    });
  });
});
