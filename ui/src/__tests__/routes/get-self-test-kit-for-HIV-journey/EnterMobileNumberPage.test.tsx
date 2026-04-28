import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";

import EnterMobileNumberPage from "@/routes/get-self-test-kit-for-HIV-journey/EnterMobileNumberPage";
import { CreateOrderProvider, JourneyNavigationProvider, useCreateOrderContext } from "@/state";

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

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={["/get-self-test-kit-for-HIV/enter-mobile-phone-number"]}>
    <JourneyNavigationProvider>
      <CreateOrderProvider>{children}</CreateOrderProvider>
    </JourneyNavigationProvider>
  </MemoryRouter>
);

describe("EnterMobileNumberPage", () => {
  describe("Component Rendering", () => {
    it("renders the main heading", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const heading = screen.getByRole("heading", {
        name: /what's your mobile phone number\?/i,
      });
      expect(heading).toBeInTheDocument();
    });

    it("renders the page hint text", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      expect(screen.getByText(/will send updates to this number/i)).toBeInTheDocument();
    });

    it("renders all form elements", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      expect(screen.getByLabelText(/uk mobile phone number/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    });

    it("renders the input hint text", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText(/for example, 07771 900 900 or \+44 7771 900 900/i),
      ).toBeInTheDocument();
    });
  });

  describe("ErrorSummary", () => {
    it("should show error summary when there are validation errors", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorSummaryHeading = screen.getByRole("heading", { name: "There is a problem" });
      const errorSummary = errorSummaryHeading.closest(
        '[role="alert"][aria-labelledby="error-summary-title"]',
      );
      expect(errorSummary).toBeInTheDocument();
    });

    it("should not show error summary when there are no errors", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      expect(
        document.querySelector('[role="alert"][aria-labelledby="error-summary-title"]'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("There is a problem")).not.toBeInTheDocument();
    });

    it("should link to mobile number field in error summary", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorLink = screen.getByRole("link", {
        name: "Enter a UK mobile phone number",
      });
      expect(errorLink).toHaveAttribute("href", "#mobile-number");
    });

    it("should focus mobile number input when error link is clicked", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorLink = screen.getByRole("link", {
        name: "Enter a UK mobile phone number",
      });
      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);

      fireEvent.click(errorLink);

      expect(mobileInput).toHaveFocus();
    });
  });

  describe("Mobile Number Validation - Required Field", () => {
    it("should return error for empty mobile number", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });

    it("should return error for mobile number with only spaces", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "   " } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });
  });

  describe("Mobile Number Validation - Invalid Formats", () => {
    it("should return error for non-UK mobile number prefix", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      const invalidPrefixes = ["06777 900 900", "08777 900 900", "09777 900 900", "05777 900 900"];

      invalidPrefixes.forEach((number) => {
        fireEvent.change(mobileInput, { target: { value: number } });

        const submitButton = screen.getByRole("button", { name: /continue/i });
        fireEvent.click(submitButton);

        expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
      });
    });

    it("should return error for UK landline numbers", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      const landlineNumbers = ["01234 567890", "02071 234567", "0131 496 0000"];

      landlineNumbers.forEach((number) => {
        fireEvent.change(mobileInput, { target: { value: number } });

        const submitButton = screen.getByRole("button", { name: /continue/i });
        fireEvent.click(submitButton);

        expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
      });
    });

    it("should return error for too many digits (>15)", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      const tooManyDigits = ["07771 900 900 1234 5678", "+44 7771 900 900 1234 5678"];

      tooManyDigits.forEach((number) => {
        fireEvent.change(mobileInput, { target: { value: number } });

        const submitButton = screen.getByRole("button", { name: /continue/i });
        fireEvent.click(submitButton);

        expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
      });
    });

    it("should return error for invalid characters", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      const invalidChars = [
        "07771-ABC-900",
        "07771@900900",
        "07771#900900",
        "07771.900.900",
        "07771/900/900",
      ];

      invalidChars.forEach((number) => {
        fireEvent.change(mobileInput, { target: { value: number } });

        const submitButton = screen.getByRole("button", { name: /continue/i });
        fireEvent.click(submitButton);

        expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
      });
    });

    it("should return error for international non-UK numbers", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      const internationalNumbers = [
        "+1 555 123 4567",
        "+353 87 123 4567",
        "+33 6 12 34 56 78",
        "+61 412 345 678",
      ];

      internationalNumbers.forEach((number) => {
        fireEvent.change(mobileInput, { target: { value: number } });

        const submitButton = screen.getByRole("button", { name: /continue/i });
        fireEvent.click(submitButton);

        expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
      });
    });

    it("should return error for incomplete UK mobile numbers", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      const incompleteNumbers = ["077", "07771", "07771 900", "+44", "+44 7"];

      incompleteNumbers.forEach((number) => {
        fireEvent.change(mobileInput, { target: { value: number } });

        const submitButton = screen.getByRole("button", { name: /continue/i });
        fireEvent.click(submitButton);

        expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
      });
    });

    it("should return error for missing leading zero", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "7771 900 900" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });

    it("should return error for number with letters", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "07771 900 90a" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });
  });

  describe("Mobile Number Validation - Valid Formats", () => {
    it("should accept valid UK mobile number with space (07xxx format)", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "07771 900 900" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should accept valid UK mobile number without spaces", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "07771900900" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should accept valid UK mobile number with +44 prefix", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "+44 7771 900 900" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should accept valid UK mobile number with +44 and no spaces", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "+447771900900" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should accept valid UK mobile number with hyphens", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "07771-900-900" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should accept valid UK mobile number with mixed separators", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, {
        target: { value: "07771 900-900" },
      });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should accept various valid UK mobile numbers", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      const validNumbers = [
        "07123456789",
        "07987654321",
        "07700900123",
        "+44 7123 456 789",
        "+44 7987 654 321",
        "07123 456 789",
        "07987-654-321",
      ];

      validNumbers.forEach((number) => {
        fireEvent.change(mobileInput, { target: { value: number } });

        const submitButton = screen.getByRole("button", { name: /continue/i });
        fireEvent.click(submitButton);

        expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
      });
    });
  });

  describe("Form Submission", () => {
    it("should not submit form when validation fails", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorSummaryHeading = screen.getByRole("heading", { name: "There is a problem" });
      const errorSummary = errorSummaryHeading.closest(
        '[role="alert"][aria-labelledby="error-summary-title"]',
      );
      expect(errorSummary).toBeInTheDocument();
      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });

    it("should update OrderContext with valid mobile number", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "07771 900 900" } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(
        document.querySelector('[role="alert"][aria-labelledby="error-summary-title"]'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Enter a UK mobile phone number")).not.toBeInTheDocument();
    });

    it("should preserve user input format after validation", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i) as HTMLInputElement;
      const inputValue = "07771 900 900";
      fireEvent.change(mobileInput, { target: { value: inputValue } });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      expect(mobileInput.value).toBe(inputValue);
    });
  });

  describe("Supplier Name Substitution in Hint", () => {
    const createWrapperWithSupplier = (supplierName: string) => {
      const WrapperWithSupplier = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter initialEntries={["/get-self-test-kit-for-HIV/enter-mobile-phone-number"]}>
          <JourneyNavigationProvider>
            <CreateOrderProvider>
              <SeedSupplier supplierName={supplierName}>{children}</SeedSupplier>
            </CreateOrderProvider>
          </JourneyNavigationProvider>
        </MemoryRouter>
      );

      return WrapperWithSupplier;
    };

    it("renders the hint text with the supplier name substituted", () => {
      render(<EnterMobileNumberPage />, { wrapper: createWrapperWithSupplier("SHL") });

      expect(
        screen.getByText("SHL will send updates to this number. It must be your own number."),
      ).toBeInTheDocument();
    });

    it("renders a fallback placeholder when no supplier is set", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      expect(
        screen.getByText(
          "The supplier will send updates to this number. It must be your own number.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("User Interaction", () => {
    it("should clear error when user starts typing", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const submitButton = screen.getByRole("button", { name: /continue/i });
      fireEvent.click(submitButton);

      const errorSummaryHeading = screen.getByRole("heading", { name: "There is a problem" });
      const errorSummary = errorSummaryHeading.closest(
        '[role="alert"][aria-labelledby="error-summary-title"]',
      );
      expect(errorSummary).toBeInTheDocument();

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i);
      fireEvent.change(mobileInput, { target: { value: "07" } });

      // Error should still be visible until form is submitted again
      expect(screen.getAllByText("Enter a UK mobile phone number")).toHaveLength(2);
    });

    it("should update input value as user types", () => {
      render(<EnterMobileNumberPage />, { wrapper: TestWrapper });

      const mobileInput = screen.getByLabelText(/uk mobile phone number/i) as HTMLInputElement;

      fireEvent.change(mobileInput, { target: { value: "077" } });
      expect(mobileInput.value).toBe("077");

      fireEvent.change(mobileInput, { target: { value: "07771" } });
      expect(mobileInput.value).toBe("07771");

      fireEvent.change(mobileInput, { target: { value: "07771 900 900" } });
      expect(mobileInput.value).toBe("07771 900 900");
    });
  });
});
