/**
 * TypeScript schema definitions for the JSON CMS content system.
 * All content loaded from content.json must conform to these types.
 */

// ============================================================================
// Common Content Types
// ============================================================================

export interface NavigationContent {
  back: string;
  continue: string;
  manualEntryLink: string;
}

export interface ValidationMessages {
  postcode: {
    required: string;
    maxLength: string;
    invalid: string;
  };
  buildingName: {
    maxLength: string;
  };
  addressLine1: {
    required: string;
    maxLength: string;
    invalid: string;
  };
  addressLine2: {
    maxLength: string;
    invalid: string;
  };
  addressLine3: {
    maxLength: string;
    invalid: string;
  };
  townOrCity: {
    required: string;
    maxLength: string;
    invalid: string;
  };
  deliveryAddress: {
    required: string;
  };
  comfortableDoingTest: {
    required: string;
  };
  mobileNumber: {
    required: string;
    invalid: string;
  };
  consent: {
    required: string;
  };
}

export interface CommonLinks {
  sexualHealthClinic: {
    text: string;
    href: string;
  };
  findAnotherSexualHealthClinic: {
    text: string;
    href: string;
  };
  nearestAE: {
    text: string;
    href: string;
  };
  learnMoreAboutHivAndAids: {
    text: string;
    href: string;
  };
  bloodSampleGuide: {
    text: string;
  };
}

export interface ErrorSummaryContent {
  title: string;
}

export interface OrderStatusHeaderContent {
  orderedPrefix: string;
  referenceNumberPrefix: string;
}

export interface ConfirmedStatusContent {
  tag: string;
  heading: string;
  message: string;
}

export interface DispatchedStatusContent {
  tag: string;
  heading: string;
  sentPrefix: string;
  message: string;
}

export interface ReceivedStatusContent {
  tag: string;
  heading: string;
  message: string;
}

export interface ReadyStatusContent {
  heading: string;
  viewResultLink: string;
}

export interface OrderStatusesContent {
  confirmed: ConfirmedStatusContent;
  dispatched: DispatchedStatusContent;
  received: ReceivedStatusContent;
  ready: ReadyStatusContent;
}

export interface HelpLinksContent {
  heading: string;
  contactSupplier: string;
  bloodSampleGuide: string;
  contactClinic: string;
}

export interface MoreInformationContent {
  heading: string;
}

export interface AboutServiceContent {
  heading: string;
  homeTestPrefix: string;
  termsOfUse: string;
  and: string;
  privacyPolicy: string;
}

export interface OrderStatusContent {
  header: OrderStatusHeaderContent;
  statuses: OrderStatusesContent;
  helpLinks: HelpLinksContent;
  moreInformation: MoreInformationContent;
  aboutService: AboutServiceContent;
}

export interface FooterContent {
  copyright: string;
}

export interface FeedbackContent {
  text: string;
  linkText: string;
  linkHref: string;
}

export interface CommonContent {
  navigation: NavigationContent;
  validation: ValidationMessages;
  links: CommonLinks;
  errorSummary: ErrorSummaryContent;
  orderStatus: OrderStatusContent;
  feedback: FeedbackContent;
  footer: FooterContent;
}

// ============================================================================
// Page Content Types
// ============================================================================

export interface StartPageContent {
  pageTitle: string;
  title: string;
  eligibility: {
    intro: string;
    items: string[];
  };
  resultsAndTimescales: {
    summary: string;
    intro: string;
    negative: {
      label: string;
      description: string;
    };
    reactive: {
      label: string;
      description: string;
    };
  };
  infoBox: {
    text: string;
  };
  howItWorks: {
    heading: string;
    deliveryInfo: string;
    sampleInstructions: string;
  };
  dataSharing: {
    summary: string;
    details: string;
  };
  startButton: string;
  aboutService: {
    heading: string;
    text: string;
    termsLink: string;
    privacyLink: string;
  };
  otherOptions: {
    heading: string;
    otherTests: string;
    otherTestsLink: {
      text: string;
      href: string;
    };
    clinicText: string;
    clinicLinkText: string;
    clinicTextEnd: string;
    sexualHealthText: string;
    sexualHealthLink: {
      text: string;
      href: string;
    };
  };
}

export interface EnterDeliveryAddressContent {
  title: string;
  form: {
    postcodeLabel: string;
    postcodeHint: string;
    buildingNameLabel: string;
    buildingNameHint: string;
  };
}

export interface EnterAddressManuallyContent {
  title: string;
  form: {
    addressLine1Label: string;
    addressLine2Label: string;
    addressLine3Label: string;
    townOrCityLabel: string;
    postcodeLabel: string;
    postcodeHint: string;
  };
}

export interface NoAddressFoundContent {
  title: string;
  notFoundMessage: string;
  tryNewSearchLink: string;
}

export interface SelectDeliveryAddressContent {
  title: string;
  postcodeLabel: string;
  editPostcodeLink: string;
  formLabel: string;
}

export interface HowComfortablePrickingFingerContent {
  title: string;
  instructions: string;
  steps: {
    prickFinger: string;
    fillTube: string;
  };
  image: {
    alt: string;
  };
  formLabel: string;
  options: {
    yes: {
      text: string;
      hint: string;
    };
    no: {
      text: string;
      hint: string;
    };
  };
}

export interface CannotUseServiceUnder18Content {
  title: string;
  intro: string;
  phoneLabel: string;
  directionsLinkText: string;
  findAnotherClinicLinkText: string;
  moreOptionsHeading: string;
  youngPeopleServicesText: string;
  youngPeopleServicesLinkText: string;
  learnMoreLinkText: string;
  learnMoreLinkHref: string;
}

export interface EnterMobilePhoneNumberContent {
  title: string;
  hint: string;
  form: {
    label: string;
    hint: string;
  };
}

export interface ConfirmMobilePhoneNumberContent {
  title: string;
  hint: string;
  form: {
    alternativeLabel: string;
    alternativeInputLabel: string;
    alternativeInputHint: string;
  };
  radioLegend: string;
}

export interface ConsentDeniedContent {
  title: string;
  body: string;
  helpText: string;
  linkText: string;
  orCallText: string;
  emergencyText: string;
}

export interface ServiceErrorContent {
  title: string;
  message: string;
}

export interface OrderTrackingContent {
  error: {
    title: string;
    orderNotFound: string;
    orderIdRequired: string;
  };
}

export interface TestResultsContent {
  title: string;
  error: {
    title: string;
    orderIdRequired: string;
  };
  negativeResult: {
    header: string;
    sectionAriaLabel: string;
    yourResultHeading: string;
    result: string;
    summary: string;
    windowPeriodAdvice: string;
    contactSupplierPrefix: string;
    contactSupplier: string;
    gpSharing: string;
    nextStepsHeading: string;
    nextStepsAdvice: string;
  };
  moreOptionsAndInformation: {
    heading: string;
    fullCheckPrefix: string;
    fullCheckLink: string;
    prepLink: string;
    prepAdvice: string;
    clinicLink: string;
    learnMoreHIV: string;
  };
  medicalAbbreviationsHelp: {
    intro: string;
    linkText: string;
  };
}

export interface PrivacyPolicySubsection {
  heading?: string;
  inlineHeading?: boolean;
  paragraphs?: string[];
  list?: string[];
  indented?: boolean;
  ordered?: boolean;
  listStyle?: "bullet" | "dash";
  table?: {
    caption?: string;
    headers: string[];
    rows: string[][];
  };
}

export interface PrivacyPolicySection {
  id: string;
  heading: string;
  paragraphs: string[];
  subsections?: PrivacyPolicySubsection[];
}

export interface HomeTestPrivacyPolicyContent {
  title: string;
  introduction: string[];
  sections: PrivacyPolicySection[];
}

export interface HomeTestTermsOfUseContent {
  title: string;
  introduction: string[];
  sections: PrivacyPolicySection[];
}

export interface BloodSampleGuideContent {
  title: string;
  whatsInKit: {
    summary: string;
    intro: string;
    items: string[];
    image: {
      alt: string;
      caption: string;
    };
  };
  tipsBeforeStart: {
    summary: string;
    intro: string;
    tips: string[];
  };
  steps: Array<{
    heading: string;
    image: {
      src: string;
      alt: string;
    };
    caption: string;
  }>;
}

export interface CheckYourAnswersContent {
  title: string;
  updateMessage: string;
  deliveryMessage: string;
  summaryLabels: {
    name: string;
    deliveryAddress: string;
    comfortableDoingTest: string;
    mobileNumber: string;
  };
  changeLink: string;
  consent: {
    legend: string;
    label: string;
    termsOfUseText: string;
    labelAnd: string;
    privacyPolicyText: string;
  };
  submitButton: string;
}

export interface OrderSubmittedContent {
  panel: {
    title: string;
    referenceNumberPrefix: string;
  };
  whatHappensNext: {
    heading: string;
    steps: string[];
  };
  feedback: {
    text: string;
    linkText: string;
    linkHref: string;
  };
}
export interface KitNotAvailableInAreaContent {
  title: string;
  description: string;
  moreOptionsHeading: string;
}

export interface LegalDocumentSubsection {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
}

export interface LegalDocumentSection {
  id: string;
  heading: string;
  paragraphs: string[];
  subsections?: LegalDocumentSubsection[];
}

export interface LegalDocumentContent {
  title: string;
  introduction: string[];
  sections: LegalDocumentSection[];
}

export interface SuppliersLegalDocumentsContent<TSupplierContent = LegalDocumentContent> {
  title: string;
  suppliers: Record<string, TSupplierContent>;
}

export interface GoToClinicContent {
  title: string;
  moreOptionsHeading: string;
}

export interface BeforeYouStartContent {
  pageTitle: string;
  title: string;
  urgentCard: {
    heading: string;
    hivExposureBullet: string;
    stiSymptomsBulletPrefix: string;
    stiSymptomsLink: {
      text: string;
      href: string;
    };
    transmissionInfo: string;
    aeAdvicePrefix: string;
  };
  continueButton: string;
}

// ============================================================================
// Pages Container
// ============================================================================

export interface PagesContent {
  "before-you-start": BeforeYouStartContent;
  "get-self-test-kit-for-HIV": StartPageContent;
  "enter-delivery-address": EnterDeliveryAddressContent;
  "enter-address-manually": EnterAddressManuallyContent;
  "no-address-found": NoAddressFoundContent;
  "select-delivery-address": SelectDeliveryAddressContent;
  "how-comfortable-pricking-finger": HowComfortablePrickingFingerContent;
  "cannot-use-service-under-18": CannotUseServiceUnder18Content;
  "enter-mobile-phone-number": EnterMobilePhoneNumberContent;
  "check-your-answers": CheckYourAnswersContent;
  "confirm-mobile-phone-number": ConfirmMobilePhoneNumberContent;
  "consent-denied": ConsentDeniedContent;
  "service-error": ServiceErrorContent;
  "order-tracking": OrderTrackingContent;
  "test-results": TestResultsContent;
  "home-test-privacy-policy": HomeTestPrivacyPolicyContent;
  "home-test-terms-of-use": HomeTestTermsOfUseContent;
  "blood-sample-guide": BloodSampleGuideContent;
  "order-submitted": OrderSubmittedContent;
  "kit-not-available-in-area": KitNotAvailableInAreaContent;
  "go-to-clinic": GoToClinicContent;
  "suppliers-terms-conditions": SuppliersLegalDocumentsContent;
  "suppliers-privacy-policy": SuppliersLegalDocumentsContent;
}

// ============================================================================
// Root Content File Type
// ============================================================================

export interface ContentFile {
  commonContent: CommonContent;
  pages: PagesContent;
}

// ============================================================================
// content.json File Types
// ============================================================================

export type MainPagesContent = Omit<
  PagesContent,
  "home-test-privacy-policy" | "home-test-terms-of-use"
>;

export interface MainContentFile {
  commonContent: CommonContent;
  pages: MainPagesContent;
}
