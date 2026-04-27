"use client";

import { Button, Details } from "nhsuk-react-components";
import { Link } from "react-router-dom";

import { ImportantInsetText } from "@/components/ImportantInsetText";
import { LearnMoreAboutHivAndAidsLink } from "@/components/LearnMoreAboutHivAndAidsLink";
import { useContent, usePageTitle } from "@/hooks";
import FormPageLayout from "@/layouts/FormPageLayout";
import { JourneyStepNames, RoutePath } from "@/lib/models/route-paths";
import { useCreateOrderContext, useJourneyNavigationContext } from "@/state";

export default function GetSelfTestKitPage() {
  const { updateOrderAnswers } = useCreateOrderContext();
  const { goToStep, goBack, canGoBack } = useJourneyNavigationContext();
  const { commonContent, "get-self-test-kit-for-HIV": content } = useContent();

  usePageTitle(content.pageTitle);

  return (
    <FormPageLayout
      showBackButton
      onBackButtonClick={() => {
        if (canGoBack()) {
          goBack();
        } else {
          goToStep(RoutePath.BeforeYouStartPage);
        }
      }}
    >
      <h1>{content.title}</h1>

      <p>{content.eligibility.intro}</p>
      <ul className="nhsuk-list nhsuk-list--bullet">
        {content.eligibility.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <ImportantInsetText>
        <p>{content.infoBox.text}</p>
      </ImportantInsetText>

      <h2>{content.howItWorks.heading}</h2>
      <p>{content.howItWorks.deliveryInfo}</p>
      <p>
        <Link to={JourneyStepNames.BloodSampleGuide}>
          {commonContent.links.bloodSampleGuide.text}
        </Link>
      </p>
      <p>{content.howItWorks.sampleInstructions}</p>

      <Details>
        <Details.Summary>{content.resultsAndTimescales.summary}</Details.Summary>
        <Details.Text>
          <p>{content.resultsAndTimescales.intro}</p>
          <ul>
            <li>
              <span className="nhsuk-u-font-weight-bold">
                {content.resultsAndTimescales.negative.label}
              </span>
              {`: ${content.resultsAndTimescales.negative.description}`}
            </li>
            <li>
              <span className="nhsuk-u-font-weight-bold">
                {content.resultsAndTimescales.reactive.label}
              </span>
              {`: ${content.resultsAndTimescales.reactive.description}`}
            </li>
          </ul>
        </Details.Text>
      </Details>

      <Details>
        <Details.Summary>{content.dataSharing.summary}</Details.Summary>
        <Details.Text>{content.dataSharing.details}</Details.Text>
      </Details>

      <Button
        onClick={() => {
          updateOrderAnswers({
            postcodeSearch: undefined,
            buildingNumber: undefined,
            deliveryAddress: undefined,
          });
          goToStep(JourneyStepNames.EnterDeliveryAddress);
        }}
      >
        {content.startButton}
      </Button>

      <h2>{content.aboutService.heading}</h2>
      <p>
        {`${content.aboutService.text} `}
        <Link to={RoutePath.HomeTestTermsOfUsePage}>{content.aboutService.termsLink}</Link>
        {` and `}
        <Link to={RoutePath.HomeTestPrivacyPolicyPage}>{content.aboutService.privacyLink}</Link>
        {"."}
      </p>

      <h2>{content.otherOptions.heading}</h2>
      <p>
        {`${content.otherOptions.clinicText} `}
        <a href={commonContent.links.sexualHealthClinic.href}>
          {content.otherOptions.clinicLinkText}
        </a>
        {` ${content.otherOptions.clinicTextEnd}`}
      </p>
      <p>
        {`${content.otherOptions.sexualHealthText} `}
        <a href={content.otherOptions.sexualHealthLink.href}>
          {content.otherOptions.sexualHealthLink.text}
        </a>
        {"."}
      </p>

      <LearnMoreAboutHivAndAidsLink />
    </FormPageLayout>
  );
}
