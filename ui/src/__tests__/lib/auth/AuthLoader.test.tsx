import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { type InitialEntry, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { AuthLoader } from "@/lib/auth/AuthLoader";
import { SessionUnauthenticatedError, fetchSessionUser } from "@/lib/auth/fetchSessionUser";
import { RoutePath } from "@/lib/models/route-paths";
import { TestErrorBoundary } from "@/lib/test-utils/TestErrorBoundary";
import { AuthProvider, type AuthUser, useAuth } from "@/state";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

jest.mock("@/layouts/PageLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));

jest.mock("@/lib/auth/fetchSessionUser", () => ({
  ...jest.requireActual("@/lib/auth/fetchSessionUser"),
  fetchSessionUser: jest.fn(),
}));

const mockFetchSessionUser = jest.mocked(fetchSessionUser);

const mockUser: AuthUser = {
  sub: "test-user-123",
  nhsNumber: "9876543210",
  birthdate: "1985-05-15",
  identityProofingLevel: "P9",
  phoneNumber: "07700900123",
  givenName: "John",
  familyName: "Smith",
  email: "john.smith@example.com",
};

function ProtectedOutletContent() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div>
      <div>Protected content</div>
      <div data-testid="user-sub">{user?.sub ?? "no-user"}</div>
      <div data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</div>
    </div>
  );
}

function renderProtectedRoute(initialEntry: InitialEntry) {
  return render(
    <TestErrorBoundary>
      <AuthProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/protected" element={<AuthLoader />}>
              <Route index element={<ProtectedOutletContent />} />
            </Route>
            <Route path={RoutePath.LoginPage} element={<div>Login page</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </TestErrorBoundary>,
  );
}

describe("AuthLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders public routes without checking the session", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[RoutePath.LoginPage]}>
          <Routes>
            <Route
              path={RoutePath.LoginPage}
              element={
                <AuthLoader>
                  <div>Public content</div>
                </AuthLoader>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByText("Public content")).toBeInTheDocument();
    expect(mockFetchSessionUser).not.toHaveBeenCalled();
  });

  it("renders ConsentDeniedPage without checking the session", () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[RoutePath.ConsentDeniedPage]}>
          <Routes>
            <Route
              path={RoutePath.ConsentDeniedPage}
              element={
                <AuthLoader>
                  <div>Consent denied content</div>
                </AuthLoader>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(screen.getByText("Consent denied content")).toBeInTheDocument();
    expect(mockFetchSessionUser).not.toHaveBeenCalled();
  });

  it("loads the session user and renders the protected outlet", async () => {
    mockFetchSessionUser.mockResolvedValue(mockUser);

    renderProtectedRoute({ pathname: "/protected" });

    expect(screen.getByRole("heading", { name: "Loading page" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Protected content")).toBeInTheDocument();
    });

    expect(mockFetchSessionUser).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("user-sub")).toHaveTextContent(mockUser.sub);
    expect(screen.getByTestId("location")).toHaveTextContent("/protected");
  });

  it("redirects unauthenticated users to login with returnTo", async () => {
    mockFetchSessionUser.mockRejectedValue(new SessionUnauthenticatedError());

    renderProtectedRoute({ pathname: "/protected", search: "?foo=bar", hash: "#section" });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/login?returnTo=%2Fprotected%3Ffoo%3Dbar%23section",
        { replace: true },
      );
    });

    expect(mockFetchSessionUser).toHaveBeenCalledTimes(1);
  });

  it("throws non-401 session errors to the error boundary", async () => {
    mockFetchSessionUser.mockRejectedValue(new Error("Session check failed"));

    renderProtectedRoute("/protected");

    await waitFor(() => {
      expect(screen.getByText("Session check failed")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
