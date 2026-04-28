import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

import ConfirmMobileNumberPage from "@/routes/get-self-test-kit-for-HIV-journey/ConfirmMobileNumberPage";
import {
  AuthProvider,
  CreateOrderProvider,
  JourneyNavigationProvider,
  useAuth,
  useCreateOrderContext,
} from "@/state";

interface SeedSupplierProps {
  children: React.ReactNode;
  supplierName: string;
}

const SeedSupplier = ({ children, supplierName }: SeedSupplierProps) => {
  const { updateOrderAnswers } = useCreateOrderContext();

  React.useEffect(() => {
    updateOrderAnswers({
      supplier: [{ id: "supplier-1", name: supplierName, testCode: "HIV-001" }],
    });
  }, [supplierName, updateOrderAnswers]);

  return <>{children}</>;
};

interface SeedUserProps {
  children: React.ReactNode;
  phoneNumber: string;
}

const SeedUser = ({ children, phoneNumber }: SeedUserProps) => {
  const { setUser } = useAuth();

  React.useEffect(() => {
    setUser({
      sub: "test-user-123",
      nhsNumber: "1234567890",
      birthdate: "1990-01-01",
      identityProofingLevel: "P9",
      phoneNumber,
      givenName: "John",
      familyName: "Smith",
      email: "john.smith@example.com",
    });
  }, [phoneNumber, setUser]);

  return <>{children}</>;
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={["/get-self-test-kit-for-HIV/confirm-mobile-phone-number"]}>
    <AuthProvider>
      <JourneyNavigationProvider>
        <CreateOrderProvider>{children}</CreateOrderProvider>
      </JourneyNavigationProvider>
    </AuthProvider>
  </MemoryRouter>
);

describe("ConfirmMobileNumberPage", () => {
  describe("Component Rendering (AC2)", () => {
    it("renders the main heading", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const heading = screen.getByRole("heading", {
        name: /what's your mobile phone number\?/i,
      });
      expect(heading).toBeInTheDocument();
    });

    it("renders the hint text", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/will send updates to this number/i)).toBeInTheDocument();
    });

    it("renders NHS Login phone number as first radio option", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const radioButtons = screen.getAllByRole("radio");
      expect(radioButtons).toHaveLength(2);
    });

    it("renders 'Use another mobile phone number' radio option", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      expect(screen.getByLabelText(/use another mobile phone number/i)).toBeInTheDocument();
    });

    it("renders continue button", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    });
  });

  describe("ErrorSummary", () => {
    it("should show error summary when there are validation errors", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorSummaryHeading = screen.getByRole("heading", { name: "There is a problem" });
      const errorSummary = errorSummaryHeading.closest(
        '[role="alert"][aria-labelledby="error-summary-title"]',
      );
      expect(errorSummary).toBeInTheDocument();
    });

    it("should not show error summary when there are no errors", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      expect(
        document.querySelector('[role="alert"][aria-labelledby="error-summary-title"]'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("There is a problem")).not.toBeInTheDocument();
    });
  });

  describe("No Radio Selected (AC3)", () => {
    it("should show error when continue clicked without selecting a radio button", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(
        screen.getAllByText("Select your mobile phone number or use another mobile phone number"),
      ).toHaveLength(2); // One in error summary, one on field
    });

    it("should show error in error summary when no selection made", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorLink = screen.getByRole("link", {
        name: "Select your mobile phone number or use another mobile phone number",
      });
      expect(errorLink).toBeInTheDocument();
      expect(errorLink).toHaveAttribute("href", "#phone-confirmation");
    });
  });

  describe("Conditional Reveal (AC4)", () => {
    it("should not show alternative number input initially", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      expect(screen.queryByLabelText(/uk mobile phone number/i)).not.toBeInTheDocument();
    });

    it("should show alternative number input when 'Use another' is selected", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      expect(screen.getByLabelText(/uk mobile phone number/i)).toBeInTheDocument();
    });

    it("should show hint text for alternative number input", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      expect(
        screen.getByText(/for example, 07771 900 900 or \+44 7771 900 900/i),
      ).toBeInTheDocument();
    });
  });

  describe("Alternative Number - Invalid Format (AC5)", () => {
    it("should show error for invalid mobile number format", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(alternativeInput, { target: { value: "123456" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });

    it("should show error for non-UK mobile number", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(alternativeInput, { target: { value: "+1 555 123 4567" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });

    it("should show error for mobile number with invalid characters", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(alternativeInput, { target: { value: "07771ABC900" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });
  });

  describe("Alternative Number - Empty Field (AC6)", () => {
    it("should show error when alternative selected but no number entered", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });

    it("should show error when alternative selected with only spaces", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(alternativeInput, { target: { value: "   " } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });
  });

  describe("Valid Alternative Number Submission", () => {
    it("should accept valid UK mobile with 07 prefix", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(alternativeInput, { target: { value: "07999 888 777" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should accept valid UK mobile with +44 prefix", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(alternativeInput, { target: { value: "+44 7999 888 777" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should accept valid UK mobile with various formatting", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const validNumbers = ["07999888777", "07999-888-777", "(07999) 888777"];

      validNumbers.forEach((number) => {
        const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
        fireEvent.change(alternativeInput, { target: { value: number } });

        const submitButton = screen.getByRole("button", { name: /continue/i });
        fireEvent.click(submitButton);

        expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
      });
    });
  });

  describe("NHS Phone Number Selection and Submission (AC1)", () => {
    it("should successfully submit when NHS phone number is selected", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const radioButtons = screen.getAllByRole("radio");
      const nhsRadio = radioButtons[0];
      fireEvent.click(nhsRadio);

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(
        document.querySelector('[role="alert"][aria-labelledby="error-summary-title"]'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Select your mobile phone number or use another mobile phone number"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Radio Button Interaction", () => {
    it("should allow selecting NHS phone radio button", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const radioButtons = screen.getAllByRole("radio");
      const nhsRadio = radioButtons[0];

      fireEvent.click(nhsRadio);
      expect(nhsRadio).toBeChecked();
    });

    it("should allow selecting alternative phone radio button", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);

      fireEvent.click(alternativeRadio);
      expect(alternativeRadio).toBeChecked();
    });

    it("should only allow one radio button to be selected at a time", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const radioButtons = screen.getAllByRole("radio");
      const nhsRadio = radioButtons[0];
      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);

      fireEvent.click(nhsRadio);
      expect(nhsRadio).toBeChecked();
      expect(alternativeRadio).not.toBeChecked();

      fireEvent.click(alternativeRadio);
      expect(alternativeRadio).toBeChecked();
      expect(nhsRadio).not.toBeChecked();
    });

    it("should clear error when radio button is selected after error", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(
        screen.getAllByText("Select your mobile phone number or use another mobile phone number"),
      ).toHaveLength(2);

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      expect(
        screen.queryAllByText("Select your mobile phone number or use another mobile phone number"),
      ).toHaveLength(0);
    });
  });

  describe("Back Button Functionality", () => {
    it("renders back button", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      // The back button is rendered as a button element, not a link
      const backButton = screen.getByText(/back/i);
      expect(backButton).toBeInTheDocument();
    });
  });

  describe("Error Focus Management", () => {
    it("should focus error link in error summary", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorLink = screen.getByRole("link", {
        name: "Select your mobile phone number or use another mobile phone number",
      });

      fireEvent.click(errorLink);

      const radioButtons = screen.getAllByRole("radio");
      expect(radioButtons[0]).toHaveFocus();
    });

    it("should focus alternative input when error and alternative radio selected", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorLink = screen.getByRole("link", {
        name: "Enter a UK mobile phone number",
      });

      fireEvent.click(errorLink);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
      expect(alternativeInput).toHaveFocus();
    });
  });

  describe("Form Input Handling", () => {
    it("should update alternative number input value on change", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i) as HTMLInputElement;
      fireEvent.change(alternativeInput, { target: { value: "07999 888 777" } });

      expect(alternativeInput.value).toBe("07999 888 777");
    });

    it("should preserve alternative number value when switching between radios", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      const radioButtons = screen.getAllByRole("radio");
      const nhsRadio = radioButtons[0];
      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);

      fireEvent.click(alternativeRadio);
      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i) as HTMLInputElement;
      fireEvent.change(alternativeInput, { target: { value: "07999 888 777" } });

      fireEvent.click(nhsRadio);
      fireEvent.click(alternativeRadio);

      const alternativeInputAgain = screen.getByLabelText(
        /uk mobile phone number/i,
      ) as HTMLInputElement;
      expect(alternativeInputAgain.value).toBe("07999 888 777");
    });
  });

  describe("Supplier Name Substitution in Hint", () => {
    const createWrapperWithSupplier = (supplierName: string) => {
      const WrapperWithSupplier = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter initialEntries={["/get-self-test-kit-for-HIV/confirm-mobile-phone-number"]}>
          <AuthProvider>
            <JourneyNavigationProvider>
              <CreateOrderProvider>
                <SeedSupplier supplierName={supplierName}>{children}</SeedSupplier>
              </CreateOrderProvider>
            </JourneyNavigationProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      return WrapperWithSupplier;
    };

    it("renders the radio-group hint with the supplier name substituted", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: createWrapperWithSupplier("SHL") });

      expect(
        screen.getByText("SHL will send updates to this number. It must be your own number."),
      ).toBeInTheDocument();
    });

    it("renders a fallback placeholder when no supplier is set", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText(
          "The supplier will send updates to this number. It must be your own number.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("NHS Login Phone Number Scenarios", () => {
    // Helper to create wrapper with specific user phone number
    const createWrapperWithPhone = (phoneNumber: string) => {
      const WrapperWithPhone = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter initialEntries={["/get-self-test-kit-for-HIV/confirm-mobile-phone-number"]}>
          <AuthProvider>
            <JourneyNavigationProvider>
              <CreateOrderProvider>
                <SeedUser phoneNumber={phoneNumber}>{children}</SeedUser>
              </CreateOrderProvider>
            </JourneyNavigationProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      return WrapperWithPhone;
    };

    it("should display NHS phone number when user has phoneNumber from NHS Login (AC1, AC2)", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: createWrapperWithPhone("07402123456") });

      const nhsPhone = screen.getByText("07402123456");
      expect(nhsPhone).toBeInTheDocument();

      const radioButtons = screen.getAllByRole("radio");
      expect(radioButtons).toHaveLength(2);
      expect(radioButtons[0]).toHaveAccessibleName("07402123456");
      expect(screen.getByLabelText(/use another mobile phone number/i)).toBeInTheDocument();
    });

    it("should handle user without NHS Login phone number", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: createWrapperWithPhone("") });

      expect(
        screen.getByRole("heading", {
          name: /what's your mobile phone number\?/i,
        }),
      ).toBeInTheDocument();

      const radioButtons = screen.getAllByRole("radio");
      expect(radioButtons).toHaveLength(2);
      expect(screen.getByLabelText(/use another mobile phone number/i)).toBeInTheDocument();
    });

    it("should allow user with NHS Login phone to select alternative number", () => {
      render(<ConfirmMobileNumberPage />, { wrapper: createWrapperWithPhone("07402123456") });

      const alternativeRadio = screen.getByLabelText(/use another mobile phone number/i);
      fireEvent.click(alternativeRadio);

      const alternativeInput = screen.getByLabelText(/uk mobile phone number/i);
      expect(alternativeInput).toBeInTheDocument();

      fireEvent.change(alternativeInput, { target: { value: "07999 888 777" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(
        document.querySelector('[role="alert"][aria-labelledby="error-summary-title"]'),
      ).not.toBeInTheDocument();
    });
  });
});
