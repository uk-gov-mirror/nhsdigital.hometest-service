import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { RoutePath } from "@/lib/models/route-paths";
import GetSelfTestKitPage from "@/routes/get-self-test-kit-for-HIV-journey/GetSelfTestKitPage";
import { CreateOrderProvider, JourneyNavigationProvider } from "@/state";

const mockGoToStep = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockNavigationContext = {
  goToStep: mockGoToStep,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
  stepHistory: ["/get-self-test-kit-for-HIV"] as string[],
  currentStep: "/get-self-test-kit-for-HIV",
};

const mockUpdateOrderAnswers = jest.fn();

jest.mock("@/state", () => ({
  ...jest.requireActual("@/state"),
  useJourneyNavigationContext: () => mockNavigationContext,
  useCreateOrderContext: () => ({
    updateOrderAnswers: mockUpdateOrderAnswers,
    orderAnswers: {},
  }),
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={["/get-self-test-kit-for-HIV"]}>
    <JourneyNavigationProvider>
      <CreateOrderProvider>{children}</CreateOrderProvider>
    </JourneyNavigationProvider>
  </MemoryRouter>
);

describe("GetSelfTestKitPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationContext.stepHistory = ["/get-self-test-kit-for-HIV"];
    render(<GetSelfTestKitPage />, { wrapper: TestWrapper });
  });

  it("renders the main heading", () => {
    expect(
      screen.getByRole("heading", { name: "Order a free HIV self-test kit" }),
    ).toBeInTheDocument();
  });

  it("renders the eligibility intro and list items", () => {
    expect(screen.getByText("You can use this service if:")).toBeInTheDocument();
    expect(screen.getByText("you're aged 18 or over")).toBeInTheDocument();
    expect(screen.getByText("the kit's available in your area")).toBeInTheDocument();
    expect(screen.getByText("you're ordering for yourself")).toBeInTheDocument();
  });

  it("renders the infoBox text", () => {
    expect(screen.getByText(/HIV can take up to 45 days after exposure/)).toBeInTheDocument();
  });

  it("renders the inset text with a visually hidden label for screen readers", () => {
    expect(screen.getByText("Important Information:")).toHaveClass("nhsuk-u-visually-hidden");
  });

  it("renders the how it works section", () => {
    expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument();
  });

  it("renders the results and timescales details summary", () => {
    expect(screen.getByText("Results and timescales")).toBeInTheDocument();
  });

  it("renders the data sharing details summary", () => {
    expect(screen.getByText("Who my information is shared with")).toBeInTheDocument();
  });

  it("renders the start now button", () => {
    expect(screen.getByRole("button", { name: "Start now" })).toBeInTheDocument();
  });

  it("sets the document title", () => {
    expect(document.title).toBe("Order a free HIV self-test kit - HomeTest - NHS");
  });
});

describe("GetSelfTestKitPage back button", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls goBack when stepHistory has more than one entry", () => {
    mockCanGoBack.mockReturnValue(true);
    render(<GetSelfTestKitPage />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByText("Back"));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockGoToStep).not.toHaveBeenCalled();
  });

  it("navigates to BeforeYouStartPage when stepHistory has one entry", () => {
    mockCanGoBack.mockReturnValue(false);
    render(<GetSelfTestKitPage />, { wrapper: TestWrapper });
    fireEvent.click(screen.getByText("Back"));
    expect(mockGoToStep).toHaveBeenCalledWith(RoutePath.BeforeYouStartPage);
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
