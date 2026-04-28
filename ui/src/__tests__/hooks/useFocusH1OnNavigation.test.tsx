import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

import { useFocusH1OnNavigation } from "@/hooks";

function PageWithH1({ title }: Readonly<{ title: string }>) {
  useFocusH1OnNavigation();
  return <h1>{title}</h1>;
}

function NavButton({ to }: Readonly<{ to: string }>) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>navigate</button>;
}

function TestApp() {
  return (
    <MemoryRouter initialEntries={["/page-a"]}>
      <NavButton to="/page-b" />
      <Routes>
        <Route path="/page-a" element={<PageWithH1 title="Page A" />} />
        <Route path="/page-b" element={<PageWithH1 title="Page B" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("useFocusH1OnNavigation", () => {
  it("focuses the h1 on initial render", () => {
    render(<TestApp />);

    expect(screen.getByRole("heading", { level: 1, name: "Page A" })).toHaveFocus();
  });

  it("sets tabindex -1 on the h1", () => {
    render(<TestApp />);

    expect(screen.getByRole("heading", { level: 1, name: "Page A" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("focuses the h1 of the new page after navigation", () => {
    render(<TestApp />);

    fireEvent.click(screen.getByRole("button", { name: "navigate" }));

    expect(screen.getByRole("heading", { level: 1, name: "Page B" })).toHaveFocus();
  });

  it("does not throw when no h1 is present", () => {
    function NoH1Page() {
      useFocusH1OnNavigation();
      return <p>No heading</p>;
    }

    expect(() =>
      render(
        <MemoryRouter>
          <NoH1Page />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});
