import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";

import { ImportantInsetText } from "@/components/ImportantInsetText";

describe("ImportantInsetText", () => {
  it("renders children", () => {
    render(<ImportantInsetText>Some content</ImportantInsetText>);

    expect(screen.getByText("Some content")).toBeInTheDocument();
  });

  it("renders a visually hidden label for screen readers", () => {
    render(<ImportantInsetText>content</ImportantInsetText>);

    const label = screen.getByText("Important Information:");
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass("nhsuk-u-visually-hidden");
  });

  it("applies the nhsuk-inset-text class by default", () => {
    const { container } = render(<ImportantInsetText>content</ImportantInsetText>);

    expect(container.firstChild).toHaveClass("nhsuk-inset-text");
  });

  it("merges an additional className with nhsuk-inset-text", () => {
    const { container } = render(
      <ImportantInsetText className="custom-class">content</ImportantInsetText>,
    );

    expect(container.firstChild).toHaveClass("nhsuk-inset-text", "custom-class");
  });

  it("passes additional HTML attributes through to the div", () => {
    render(
      <ImportantInsetText data-testid="inset" aria-label="important info">
        content
      </ImportantInsetText>,
    );

    const div = screen.getByTestId("inset");
    expect(div).toHaveAttribute("aria-label", "important info");
  });

  it("forwards a ref to the underlying div element", () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(<ImportantInsetText ref={ref}>content</ImportantInsetText>);

    expect(ref.current).toBe(container.firstChild);
  });
});
