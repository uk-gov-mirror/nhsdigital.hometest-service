import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import ConsentDeniedPage from "@/routes/ConsentDeniedPage";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("@/hooks", () => ({
  useContent: () => ({
    "consent-denied": {
      title: "You did not agree to share your NHS login information",
      body: "You cannot use the HomeTest service without sharing your NHS login information.",
      helpText: "If you need urgent medical help, visit",
      linkText: "111.nhs.uk",
      orCallText: "or call 111 or your GP.",
      emergencyText: "Call 999 if it's a life threatening emergency",
    },
  }),
}));

jest.mock("@/layouts/PageLayout", () => ({
  __esModule: true,
  default: ({
    children,
    onBackButtonClick,
  }: {
    children: React.ReactNode;
    onBackButtonClick?: () => void;
  }) => (
    <div data-testid="page-layout">
      {onBackButtonClick && (
        <button data-testid="back-button" onClick={onBackButtonClick}>
          Back
        </button>
      )}
      {children}
    </div>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/consent-denied"]}>
      <ConsentDeniedPage />
    </MemoryRouter>,
  );

describe("ConsentDeniedPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the heading", () => {
    renderPage();

    expect(
      screen.getByRole("heading", {
        name: "You did not agree to share your NHS login information",
      }),
    ).toBeInTheDocument();
  });

  it("renders the body text", () => {
    renderPage();

    expect(
      screen.getByText(
        "You cannot use the HomeTest service without sharing your NHS login information.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the 111.nhs.uk link pointing to the correct URL in the same tab", () => {
    renderPage();

    const link = screen.getByRole("link", { name: "111.nhs.uk" });
    expect(link).toHaveAttribute("href", "https://111.nhs.uk");
    expect(link).not.toHaveAttribute("target", "_blank");
  });

  it("renders the or call 111 text alongside the link", () => {
    renderPage();

    expect(screen.getByText(/or call 111 or your GP\./)).toBeInTheDocument();
  });

  it("renders the emergency text", () => {
    renderPage();

    expect(screen.getByText("Call 999 if it's a life threatening emergency")).toBeInTheDocument();
  });

  it("renders inside the page layout", () => {
    renderPage();

    expect(screen.getByTestId("page-layout")).toBeInTheDocument();
  });

  it("calls navigate(-1) when the back button is clicked", () => {
    renderPage();

    fireEvent.click(screen.getByTestId("back-button"));

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
