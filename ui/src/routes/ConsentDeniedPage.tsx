import { useNavigate } from "react-router-dom";

import { useContent } from "@/hooks";
import PageLayout from "@/layouts/PageLayout";

export default function ConsentDeniedPage() {
  const navigate = useNavigate();
  const { "consent-denied": content } = useContent();

  return (
    <PageLayout onBackButtonClick={() => navigate(-1)}>
      <h1>{content.title}</h1>
      <p>{content.body}</p>
      <p>
        {content.helpText} <a href="https://111.nhs.uk">{content.linkText}</a> {content.orCallText}
      </p>

      <p>{content.emergencyText}</p>
    </PageLayout>
  );
}
