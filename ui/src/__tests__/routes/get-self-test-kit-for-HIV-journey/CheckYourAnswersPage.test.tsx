import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { RoutePath } from "@/lib/models/route-paths";
import orderService from "@/lib/services/order-service";
import { TestErrorBoundary } from "@/lib/test-utils/TestErrorBoundary";
import CheckYourAnswersPage from "@/routes/get-self-test-kit-for-HIV-journey/CheckYourAnswersPage";
import {
  AuthProvider,
  AuthUser,
  CreateOrderProvider,
  useAuth,
  useCreateOrderContext,
} from "@/state";

const mockNavigate = jest.fn();
const mockClearAddresses = jest.fn();
let mockNavigationType = "PUSH";

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useNavigationType: () => mockNavigationType,
  };
});

const mockGoToStep = jest.fn();
const mockSetReturnToStep = jest.fn();
const mockGoBack = jest.fn();
const mockResetNavigation = jest.fn();

jest.mock("@/state", () => {
  const actual = jest.requireActual("@/state");
  return {
    ...actual,
    useJourneyNavigationContext: () => ({
      currentStep: "check-your-answers",
      stepHistory: ["enter-mobile-phone-number", "check-your-answers"],
      returnToStep: null,
      goToStep: mockGoToStep,
      goBack: mockGoBack,
      canGoBack: () => true,
      clearHistory: jest.fn(),
      resetNavigation: mockResetNavigation,
      setReturnToStep: mockSetReturnToStep,
    }),
    usePostcodeLookup: () => ({
      postcode: "",
      addresses: [],
      selectedAddress: null,
      isLoading: false,
      lookupResultsStatus: "idle",
      error: null,
      lookupPostcode: jest.fn(),
      setSelectedAddress: jest.fn(),
      clearAddresses: mockClearAddresses,
    }),
  };
});

jest.mock("@/lib/services/order-service", () => ({
  __esModule: true,
  default: {
    submitOrder: jest.fn().mockResolvedValue({
      orderReference: 0,
      orderUid: "",
      message: "",
    }),
  },
}));

const mockSubmitOrder = orderService.submitOrder as jest.Mock;

const defaultAuthUser: AuthUser = {
  sub: "test-sub",
  nhsNumber: "1234567890",
  birthdate: "1990-01-01",
  identityProofingLevel: "P9",
  phoneNumber: "07402123123",
  givenName: "John",
  familyName: "Smith",
  email: "john.smith@example.com",
};

// Helper component to pre-populate order state
function StateSeeder({
  children,
  orderData,
}: Readonly<{
  children: ReactNode;
  orderData: Record<string, unknown>;
}>) {
  const { updateOrderAnswers } = useCreateOrderContext();

  useEffect(() => {
    updateOrderAnswers(orderData);
  }, [orderData, updateOrderAnswers]);

  return <>{children}</>;
}

// Helper component to set auth user
function AuthSeeder({
  children,
  user = defaultAuthUser,
}: Readonly<{
  children: ReactNode;
  user?: AuthUser;
}>) {
  const { setUser } = useAuth();

  useEffect(() => {
    setUser(user);
  }, [setUser, user]);

  return <>{children}</>;
}

function OrderReferenceObserver() {
  const { orderAnswers } = useCreateOrderContext();

  return <span data-testid="order-reference">{orderAnswers.orderReferenceNumber || ""}</span>;
}

const defaultOrderData = {
  deliveryAddress: {
    addressLine1: "73 Roman Rd",
    postTown: "Leeds",
    postcode: "LS2 5ZN",
  },
  comfortableDoingTest: "Yes",
  mobileNumber: "07402123123",
};

const TestWrapper = ({
  children,
  orderData = defaultOrderData,
}: {
  children: ReactNode;
  orderData?: Record<string, unknown>;
}) => (
  <MemoryRouter initialEntries={["/get-self-test-kit-for-HIV/check-your-answers"]}>
    <AuthProvider>
      <CreateOrderProvider>
        <AuthSeeder>
          <StateSeeder orderData={orderData}>{children}</StateSeeder>
        </AuthSeeder>
      </CreateOrderProvider>
    </AuthProvider>
  </MemoryRouter>
);

describe("CheckYourAnswersPage", () => {
  const submitForm = () => {
    const form = screen.getByRole("button", { name: /submit order/i }).closest("form");

    if (!form) {
      throw new Error("Submit form not found");
    }

    fireEvent.submit(form);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigationType = "PUSH";
  });

  describe("Component Rendering", () => {
    it("renders the main heading", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      const heading = screen.getByRole("heading", {
        name: /check your answers/i,
      });
      expect(heading).toBeInTheDocument();
    });

    it("renders the update message", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText(
          /we'll update you about your hiv test on the account you use for your nhs login/i,
        ),
      ).toBeInTheDocument();
    });

    it("renders the delivery message", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/the kit will arrive within 5 working days/i)).toBeInTheDocument();
    });

    it("renders the submit order button", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(screen.getByRole("button", { name: /submit order/i })).toBeInTheDocument();
    });
  });

  describe("Summary List Content", () => {
    it("displays the user name", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(screen.getByText("John Smith")).toBeInTheDocument();
    });

    it("displays the delivery address", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/73 Roman Rd/)).toBeInTheDocument();
      expect(screen.getByText(/Leeds/)).toBeInTheDocument();
      expect(screen.getByText(/LS2 5ZN/)).toBeInTheDocument();
    });

    it("displays the comfortable doing test answer", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/yes i'm comfortable, send me the kit/i)).toBeInTheDocument();
    });

    it("displays the mobile number", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(screen.getByText("07402123123")).toBeInTheDocument();
    });

    it("renders summary labels", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(screen.getByText("Name")).toBeInTheDocument();
      expect(
        screen.getByText("Delivery address", {
          selector: ".nhsuk-summary-list__key",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Are you comfortable doing the HIV self-test?", {
          selector: ".nhsuk-summary-list__key",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("What's your mobile phone number?", {
          selector: ".nhsuk-summary-list__key",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Change Links", () => {
    it("renders change links for editable fields", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      const changeLinks = screen.getAllByText("Change");
      // Delivery address, comfortable doing test, mobile number (3 change links)
      expect(changeLinks).toHaveLength(3);
    });

    it("does not render a change link for the name", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      const changeLinks = screen.getAllByText("Change");
      // Only 3 change links, not 4 - name has no change link
      expect(changeLinks).toHaveLength(3);
    });

    it("sets returnToStep and navigates when delivery address change is clicked", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      const changeLinks = screen.getAllByText("Change");
      fireEvent.click(changeLinks[0]);

      expect(mockSetReturnToStep).toHaveBeenCalledWith("check-your-answers");
      expect(mockGoToStep).toHaveBeenCalledWith("select-delivery-address");
    });

    it("sets returnToStep and navigates when comfortable doing test change is clicked", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      const changeLinks = screen.getAllByText("Change");
      fireEvent.click(changeLinks[1]);

      expect(mockSetReturnToStep).toHaveBeenCalledWith("check-your-answers");
      expect(mockGoToStep).toHaveBeenCalledWith("how-comfortable-pricking-finger");
    });

    it("sets returnToStep and navigates when mobile number change is clicked", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      const changeLinks = screen.getAllByText("Change");
      fireEvent.click(changeLinks[2]);

      expect(mockSetReturnToStep).toHaveBeenCalledWith("check-your-answers");
      expect(mockGoToStep).toHaveBeenCalledWith("confirm-mobile-phone-number");
    });

    it("renders visually hidden text for accessibility on change links", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText("Delivery address", {
          selector: ".nhsuk-u-visually-hidden",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Are you comfortable doing the HIV self-test?", {
          selector: ".nhsuk-u-visually-hidden",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("What's your mobile phone number?", {
          selector: ".nhsuk-u-visually-hidden",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Consent Checkbox", () => {
    it("renders the consent fieldset with legend", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(screen.getByText("Your consent")).toBeInTheDocument();
    });

    it("renders the consent checkbox", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });
  });

  describe("Submit Order", () => {
    it("does not reset when loaded via browser back without a submitted order", () => {
      mockNavigationType = "POP";

      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      expect(
        screen.getByRole("heading", {
          name: /check your answers/i,
        }),
      ).toBeInTheDocument();
      expect(mockClearAddresses).not.toHaveBeenCalled();
      expect(mockResetNavigation).not.toHaveBeenCalled();
    });

    it("clears state and redirects to start when revisited via browser back after submission", async () => {
      mockNavigationType = "POP";

      render(
        <>
          <CheckYourAnswersPage />
          <OrderReferenceObserver />
        </>,
        {
          wrapper: (props) => (
            <TestWrapper
              orderData={{
                ...defaultOrderData,
                orderReferenceNumber: 123,
              }}
              {...props}
            />
          ),
        },
      );

      await waitFor(() => {
        expect(screen.getByTestId("order-reference")).toHaveTextContent("");
      });

      expect(mockClearAddresses).toHaveBeenCalledTimes(1);
      expect(mockResetNavigation).toHaveBeenCalledTimes(1);
      expect(mockResetNavigation).toHaveBeenCalledWith(RoutePath.BeforeYouStartPage, {
        replace: true,
      });
    });

    it("shows error when submitting without consent", async () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      submitForm();

      await waitFor(() => {
        const errorSummaryHeading = screen.getByRole("heading", { name: "There is a problem" });
        const errorSummary = errorSummaryHeading.closest(
          '[role="alert"][aria-labelledby="error-summary-title"]',
        );
        expect(errorSummary).toBeInTheDocument();
        expect(
          screen.getAllByText(
            "Select if you agree to our partner's terms and conditions and privacy policy",
          ).length,
        ).toBeGreaterThanOrEqual(1);
      });
    });

    it("error summary links to consent checkbox", async () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      submitForm();

      const errorLink = await screen.findByRole("link", {
        name: "Select if you agree to our partner's terms and conditions and privacy policy",
      });
      expect(errorLink).toHaveAttribute("href", "#consent");
    });

    it("does not submit when consent is not ticked", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      submitForm();

      expect(mockSubmitOrder).not.toHaveBeenCalled();
    });

    it("updates order reference number after successful submit", async () => {
      mockSubmitOrder.mockResolvedValueOnce({
        orderReference: 123,
        orderUid: "test-uid",
        message: "Order submitted successfully",
      });

      render(
        <>
          <CheckYourAnswersPage />
          <OrderReferenceObserver />
        </>,
        { wrapper: TestWrapper },
      );

      fireEvent.click(screen.getByRole("checkbox"));
      submitForm();

      await waitFor(() => {
        expect(mockSubmitOrder).toHaveBeenCalled();
        expect(screen.getByTestId("order-reference")).toHaveTextContent("123");
      });
    });

    it("navigates to order-submitted when submission succeeds after a page refresh (POP navigation type)", async () => {
      mockNavigationType = "POP";
      mockSubmitOrder.mockResolvedValueOnce({
        orderReference: 456,
        orderUid: "test-uid",
        message: "Order submitted successfully",
      });

      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      fireEvent.click(screen.getByRole("checkbox"));
      submitForm();

      await waitFor(() => {
        expect(mockGoToStep).toHaveBeenCalledWith("order-submitted");
        expect(
          screen.getByRole("heading", {
            name: /check your answers/i,
          }),
        ).toBeInTheDocument();
      });

      expect(mockResetNavigation).not.toHaveBeenCalled();
      expect(mockClearAddresses).not.toHaveBeenCalled();
    });

    it("shows the error boundary when submitOrder rejects", async () => {
      mockSubmitOrder.mockRejectedValueOnce(new Error("Network error"));

      render(
        <TestErrorBoundary>
          <CheckYourAnswersPage />
        </TestErrorBoundary>,
        { wrapper: TestWrapper },
      );

      fireEvent.click(screen.getByRole("checkbox"));
      submitForm();

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });
  });

  describe("Back Link", () => {
    it("calls goBack when back link is clicked", () => {
      render(<CheckYourAnswersPage />, { wrapper: TestWrapper });

      const backLink = screen.getByText("Back");
      fireEvent.click(backLink);

      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
