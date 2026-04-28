/**
 * ContentValidator - Validates content structure at build/initialization time.
 *
 * This validator ensures that the loaded content JSON conforms to the expected
 * structure defined in the schema. It provides early detection of missing or
 * malformed content during development.
 */
import type {
  CommonContent,
  HomeTestPrivacyPolicyContent,
  HomeTestTermsOfUseContent,
  MainContentFile,
  MainPagesContent,
} from "./schema";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_COMMON_KEYS: (keyof CommonContent)[] = [
  "navigation",
  "validation",
  "links",
  "errorSummary",
  "orderStatus",
  "feedback",
  "footer",
];

const REQUIRED_PAGE_KEYS: (keyof MainPagesContent)[] = [
  "before-you-start",
  "get-self-test-kit-for-HIV",
  "kit-not-available-in-area",
  "go-to-clinic",
  "enter-delivery-address",
  "enter-address-manually",
  "no-address-found",
  "select-delivery-address",
  "how-comfortable-pricking-finger",
  "cannot-use-service-under-18",
  "enter-mobile-phone-number",
  "check-your-answers",
  "confirm-mobile-phone-number",
  "service-error",
  "order-tracking",
  "test-results",
  "blood-sample-guide",
  "suppliers-terms-conditions",
  "suppliers-privacy-policy",
];

// order-submitted is required to exist in the content but has no top-level title field,
// so it is kept separate from REQUIRED_PAGE_KEYS to avoid triggering the title assertion.
const REQUIRED_PAGE_PRESENCE_KEYS: ReadonlyArray<keyof MainPagesContent> = [
  ...REQUIRED_PAGE_KEYS,
  "order-submitted",
];

// All main pages that declare a pageTitle field in their schema interface.
// Supplier pages are excluded because they derive their title at render time via formatPageTitle.
const REQUIRED_PAGE_TITLE_KEYS: ReadonlyArray<keyof MainPagesContent> = [
  ...REQUIRED_PAGE_KEYS.filter(
    (k) => k !== "suppliers-terms-conditions" && k !== "suppliers-privacy-policy",
  ),
  "order-submitted",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validateCommonContent = (content: unknown, errors: string[]): content is CommonContent => {
  if (!isObject(content)) {
    errors.push("commonContent must be an object");
    return false;
  }

  for (const key of REQUIRED_COMMON_KEYS) {
    if (!(key in content)) {
      errors.push(`commonContent is missing required key: ${key}`);
    } else if (!isObject(content[key])) {
      errors.push(`commonContent.${key} must be an object`);
    }
  }

  if (isObject(content.navigation)) {
    if (!isNonEmptyString(content.navigation.back)) {
      errors.push("commonContent.navigation.back must be a non-empty string");
    }
    if (!isNonEmptyString(content.navigation.continue)) {
      errors.push("commonContent.navigation.continue must be a non-empty string");
    }
  }

  return errors.length === 0;
};

const validatePagesContent = (content: unknown, errors: string[]): content is MainPagesContent => {
  if (!isObject(content)) {
    errors.push("pages must be an object");
    return false;
  }

  for (const key of REQUIRED_PAGE_PRESENCE_KEYS) {
    if (!(key in content)) {
      errors.push(`pages is missing required key: ${key}`);
    } else if (!isObject(content[key])) {
      errors.push(`pages.${key} must be an object`);
    }
  }

  for (const key of REQUIRED_PAGE_KEYS) {
    const page = content[key];
    if (isObject(page) && !isNonEmptyString(page.title)) {
      errors.push(`pages.${key}.title must be a non-empty string`);
    }
  }

  for (const key of REQUIRED_PAGE_TITLE_KEYS) {
    const page = content[key];
    if (isObject(page) && !isNonEmptyString(page.pageTitle)) {
      errors.push(`pages.${key}.pageTitle must be a non-empty string`);
    }
  }

  return errors.length === 0;
};

export const validateContent = (content: unknown): ValidationResult => {
  const errors: string[] = [];

  if (!isObject(content)) {
    return {
      valid: false,
      errors: ["Content must be an object"],
    };
  }

  if ("commonContent" in content) {
    validateCommonContent(content.commonContent, errors);
  } else {
    errors.push("Content is missing required key: commonContent");
  }

  if ("pages" in content) {
    validatePagesContent(content.pages, errors);
  } else {
    errors.push("Content is missing required key: pages");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const isValidContentFile = (content: unknown): content is MainContentFile => {
  const result = validateContent(content);
  return result.valid;
};

export const assertValidContent: (content: unknown) => asserts content is MainContentFile = (
  content,
) => {
  const result = validateContent(content);
  if (!result.valid) {
    const errorList = result.errors.map((e) => "  - " + e).join("\n");
    throw new Error(`Content validation failed:\n${errorList}`);
  }
};

const assertValidLegalPageContent = (label: string, content: unknown): void => {
  const errors: string[] = [];
  if (!isObject(content)) {
    throw new Error(`${label} content must be an object`);
  }
  if (!isNonEmptyString(content["pageTitle"])) {
    errors.push("pageTitle must be a non-empty string");
  }
  if (!isNonEmptyString(content["title"])) {
    errors.push("title must be a non-empty string");
  }
  if (!Array.isArray(content["introduction"])) {
    errors.push("introduction must be an array");
  }
  if (!Array.isArray(content["sections"])) {
    errors.push("sections must be an array");
  }
  if (errors.length > 0) {
    const errorList = errors.map((e) => "  - " + e).join("\n");
    throw new Error(`${label} validation failed:\n${errorList}`);
  }
};

export const assertValidPrivacyPolicyContent: (
  content: unknown,
) => asserts content is HomeTestPrivacyPolicyContent = (content) => {
  assertValidLegalPageContent("Privacy policy", content);
};

export const assertValidTermsOfUseContent: (
  content: unknown,
) => asserts content is HomeTestTermsOfUseContent = (content) => {
  assertValidLegalPageContent("Terms of use", content);
};
