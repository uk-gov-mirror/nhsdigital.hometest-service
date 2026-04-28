"use client";

import { Button, Checkboxes, ErrorSummary, SummaryList } from "nhsuk-react-components";
import React, { useLayoutEffect, useState } from "react";
import { useNavigationType } from "react-router-dom";

import { useAsyncErrorHandler, useContent } from "@/hooks";
import FormPageLayout from "@/layouts/FormPageLayout";
import { JourneyStepNames, RoutePath } from "@/lib/models/route-paths";
import orderService, { OrderServiceRequest } from "@/lib/services/order-service";
import {
  useAuth,
  useCreateOrderContext,
  useJourneyNavigationContext,
  usePostcodeLookup,
} from "@/state";

// TODO: update to dynamically render supplier based on API (probably stored in state)

function formatAddress(address: {
  addressLine1?: string;
  addressLine2?: string;
  addressLine3?: string;
  addressLine4?: string;
  postTown?: string;
  postcode?: string;
}): string[] {
  return [
    address.addressLine1,
    address.addressLine2,
    address.addressLine3,
    address.addressLine4,
    address.postTown,
    address.postcode,
  ].filter((line): line is string => Boolean(line));
}

function formatUserName(user?: { givenName: string; familyName: string } | null): string {
  if (!user) return "";
  if (user.givenName && user.familyName) {
    return `${user.givenName} ${user.familyName}`;
  }
  return user.familyName || "";
}

export default function CheckYourAnswersPage() {
  const navigationType = useNavigationType();
  const { orderAnswers, updateOrderAnswers, reset } = useCreateOrderContext();
  const { goToStep, goBack, stepHistory, resetNavigation, setReturnToStep } =
    useJourneyNavigationContext();
  const { clearAddresses } = usePostcodeLookup();
  const { user } = useAuth();
  const { commonContent, "check-your-answers": content } = useContent();
  const hasSubmittedOrder = orderAnswers.orderReferenceNumber != null;

  const [consentChecked, setConsentChecked] = useState(
    orderAnswers.consentCheckboxChecked ?? false,
  );
  const [consentError, setConsentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supplierName = orderAnswers.supplier?.[0]?.name || "The supplier";
  const shouldResetSubmittedOrderOnPop =
    hasSubmittedOrder && navigationType === "POP" && !isSubmitting;

  useLayoutEffect(() => {
    if (!shouldResetSubmittedOrderOnPop) {
      return;
    }

    reset();
    clearAddresses();
    resetNavigation(RoutePath.BeforeYouStartPage, { replace: true });
  }, [clearAddresses, reset, resetNavigation, shouldResetSubmittedOrderOnPop]);

  const handleChangeClick = (field: "address" | "mobile" | "comfort") => {
    setReturnToStep(JourneyStepNames.CheckYourAnswers);

    if (field === "address") {
      // Route based on how address was entered
      if (orderAnswers.addressEntryMethod === "manual") {
        goToStep(JourneyStepNames.EnterAddressManually);
      } else {
        // Default to select address (postcode search flow)
        goToStep(JourneyStepNames.SelectDeliveryAddress);
      }
    } else if (field === "mobile") {
      // Route based on mobile number source
      if (orderAnswers.mobileNumberSource === "manual") {
        goToStep(JourneyStepNames.EnterMobileNumber);
      } else {
        // NHS Login flow
        goToStep(JourneyStepNames.ConfirmMobileNumber);
      }
    } else if (field === "comfort") {
      goToStep(JourneyStepNames.HowComfortablePrickingFinger);
    }
  };

  const handleConsentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConsentChecked(e.target.checked);
    updateOrderAnswers({ consentCheckboxChecked: e.target.checked });
  };

  const handleSubmit = useAsyncErrorHandler(async (e: React.SubmitEvent) => {
    e.preventDefault();

    if (!consentChecked) {
      setConsentError(commonContent.validation.consent.required);
      return;
    }

    setConsentError(null);

    setIsSubmitting(true);
    let hasNavigatedToSubmittedPage = false;

    try {
      const consentTimestamp = new Date().toISOString();
      updateOrderAnswers({
        consentGiven: true,
        consentTimestamp,
      });

      // Build orderRequest from OrderAnswers and User in state
      const addressLines = orderAnswers.deliveryAddress
        ? formatAddress(orderAnswers.deliveryAddress)
        : [];

      const orderRequest: OrderServiceRequest = {
        testCode: orderAnswers.supplier?.[0]?.testCode || "",
        testDescription: "HIV antigen test",
        supplierId: orderAnswers.supplier?.[0]?.id || "",
        patient: {
          family: user?.familyName || "",
          given: [user?.givenName || ""],
          text: `${user?.givenName || ""} ${user?.familyName || ""}`,
          telecom: [
            { phone: orderAnswers.mobileNumber || "" },
            { sms: orderAnswers.mobileNumber || "" },
            { email: user?.email || "" },
          ],
          address: {
            line: addressLines,
            city: orderAnswers.deliveryAddress?.postTown || "",
            postalCode: orderAnswers.deliveryAddress?.postcode || "",
            country: "United Kingdom",
          },
          birthDate: user?.birthdate || "",
          nhsNumber: user?.nhsNumber || "",
        },
        consent: true,
      };

      const orderResponse = await orderService.submitOrder(orderRequest);

      updateOrderAnswers({
        orderReferenceNumber: orderResponse.orderReference,
      });

      goToStep(JourneyStepNames.OrderSubmitted);
      hasNavigatedToSubmittedPage = true;
    } finally {
      if (!hasNavigatedToSubmittedPage) {
        setIsSubmitting(false);
      }
    }
  });

  const addressLines = orderAnswers.deliveryAddress
    ? formatAddress(orderAnswers.deliveryAddress)
    : [];

  if (shouldResetSubmittedOrderOnPop) {
    return null;
  }

  return (
    <FormPageLayout
      showBackButton
      onBackButtonClick={() => {
        if (stepHistory.length > 1) {
          goBack();
        } else {
          goToStep(JourneyStepNames.EnterMobileNumber);
        }
      }}
    >
      <h1 className="nhsuk-heading-l">{content.title}</h1>

      {consentError && (
        <ErrorSummary aria-labelledby="error-summary-title" role="alert">
          <ErrorSummary.Title id="error-summary-title">
            {commonContent.errorSummary.title}
          </ErrorSummary.Title>
          <ErrorSummary.List>
            <ErrorSummary.ListItem
              href="#consent"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("consent-1")?.focus();
              }}
            >
              {consentError}
            </ErrorSummary.ListItem>
          </ErrorSummary.List>
        </ErrorSummary>
      )}

      <p className="nhsuk-body">{content.updateMessage}</p>
      <p className="nhsuk-body">{content.deliveryMessage}</p>

      <SummaryList>
        <SummaryList.Row>
          <SummaryList.Key>{content.summaryLabels.name}</SummaryList.Key>
          <SummaryList.Value>{formatUserName(user)}</SummaryList.Value>
        </SummaryList.Row>

        <SummaryList.Row>
          <SummaryList.Key>{content.summaryLabels.deliveryAddress}</SummaryList.Key>
          <SummaryList.Value id="delivery-address-value">
            {addressLines.map((line, index) => (
              <React.Fragment key={`${index}-${line}`}>
                {line}
                {index < addressLines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </SummaryList.Value>
          <SummaryList.Action
            id="address-change"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleChangeClick("address");
            }}
            visuallyHiddenText={content.summaryLabels.deliveryAddress}
          >
            {content.changeLink}
          </SummaryList.Action>
        </SummaryList.Row>

        <SummaryList.Row>
          <SummaryList.Key>{content.summaryLabels.comfortableDoingTest}</SummaryList.Key>
          <SummaryList.Value id="comfortable-doing-test-value">
            {orderAnswers.comfortableDoingTest === "Yes"
              ? "Yes I'm comfortable, send me the kit"
              : orderAnswers.comfortableDoingTest}
          </SummaryList.Value>
          <SummaryList.Action
            id="comfortable-change"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleChangeClick("comfort");
            }}
            visuallyHiddenText={content.summaryLabels.comfortableDoingTest}
          >
            {content.changeLink}
          </SummaryList.Action>
        </SummaryList.Row>

        <SummaryList.Row>
          <SummaryList.Key>{content.summaryLabels.mobileNumber}</SummaryList.Key>
          <SummaryList.Value id="mobile-number-value">
            {orderAnswers.mobileNumber}
          </SummaryList.Value>
          <SummaryList.Action
            id="mobile-change"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleChangeClick("mobile");
            }}
            visuallyHiddenText={content.summaryLabels.mobileNumber}
          >
            {content.changeLink}
          </SummaryList.Action>
        </SummaryList.Row>
      </SummaryList>

      <form onSubmit={handleSubmit}>
        <Checkboxes
          legend={content.consent.legend}
          legendProps={{ size: "m" }}
          id="consent"
          name="consent"
          error={consentError || undefined}
        >
          <Checkboxes.Item value="consent" checked={consentChecked} onChange={handleConsentChange}>
            {`${content.consent.label.replace("{supplier}", supplierName)} `}
            <a
              href={JourneyStepNames.SuppliersTermsConditions}
              onClick={(e) => {
                e.preventDefault();
                goToStep(JourneyStepNames.SuppliersTermsConditions);
              }}
            >
              {content.consent.termsOfUseText}
            </a>
            {` ${content.consent.labelAnd} `}
            <a
              href={JourneyStepNames.SuppliersPrivacyPolicy}
              onClick={(e) => {
                e.preventDefault();
                goToStep(JourneyStepNames.SuppliersPrivacyPolicy);
              }}
            >
              {content.consent.privacyPolicyText}
            </a>
            {"."}
          </Checkboxes.Item>
        </Checkboxes>
        <Button type="submit">{content.submitButton}</Button>
      </form>
    </FormPageLayout>
  );
}
