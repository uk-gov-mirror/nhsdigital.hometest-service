import "@testing-library/jest-dom";
import { act, render, waitFor } from "@testing-library/react";

import { consumeLoginCsrf, verifyState } from "@/lib/auth/loginState";
import { RoutePath } from "@/lib/models/route-paths";
import loginService from "@/lib/services/login-service";
import CallbackPage from "@/routes/CallbackPage";
import { useAuth } from "@/state";

const mockNavigate = jest.fn();
const mockSetUser = jest.fn();
const mockHandleAsyncError = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock("@/state", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/auth/loginState", () => ({
  consumeLoginCsrf: jest.fn(),
  verifyState: jest.fn(),
}));

jest.mock("@/lib/services/login-service", () => ({
  __esModule: true,
  default: { login: jest.fn() },
}));

// Expose the handler directly so effects under test remain synchronous where possible.
jest.mock("@/hooks", () => ({
  useAsyncErrorHandler: (fn: (...args: unknown[]) => unknown) => {
    return (...args: unknown[]) => {
      try {
        const result = fn(...args);

        if (result instanceof Promise) {
          void result.catch((error) => {
            mockHandleAsyncError(error);
          });
        }

        return result;
      } catch (error) {
        mockHandleAsyncError(error);
        return undefined;
      }
    };
  },
}));

const mockedConsumeLoginCsrf = jest.mocked(consumeLoginCsrf);
const mockedVerifyState = jest.mocked(verifyState);
const mockedLoginService = jest.mocked(loginService);
const mockedUseAuth = jest.mocked(useAuth);

describe("CallbackPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: null, setUser: mockSetUser });
  });

  afterEach(() => {
    globalThis.history.replaceState({}, "", "/");
    jest.clearAllMocks();
  });

  it("does nothing when code is absent from search params", async () => {
    globalThis.history.replaceState({}, "", "/callback");

    await act(async () => {
      render(<CallbackPage />);
    });

    expect(mockedLoginService.login).not.toHaveBeenCalled();
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates to ConsentDeniedPage with replace when error=access_denied and error_description=ConsentNotGiven and state is valid", async () => {
    globalThis.history.replaceState(
      {},
      "",
      "/callback?error=access_denied&error_description=ConsentNotGiven&state=valid-state",
    );
    mockedConsumeLoginCsrf.mockReturnValue("csrf-token");
    mockedVerifyState.mockReturnValue(null);

    await act(async () => {
      render(<CallbackPage />);
    });

    expect(mockedVerifyState).toHaveBeenCalledWith({ csrf: "csrf-token", encoded: "valid-state" });
    expect(mockNavigate).toHaveBeenCalledWith(RoutePath.ConsentDeniedPage, { replace: true });
    expect(mockedLoginService.login).not.toHaveBeenCalled();
    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it("navigates to LoginPage with replace when consent denied but CSRF is missing from session storage", async () => {
    globalThis.history.replaceState(
      {},
      "",
      "/callback?error=access_denied&error_description=ConsentNotGiven&state=valid-state",
    );
    mockedConsumeLoginCsrf.mockReturnValue(null);

    await act(async () => {
      render(<CallbackPage />);
    });

    expect(mockNavigate).toHaveBeenCalledWith(RoutePath.LoginPage, { replace: true });
    expect(mockedLoginService.login).not.toHaveBeenCalled();
  });

  it("navigates to LoginPage with replace when consent denied but state verification fails", async () => {
    globalThis.history.replaceState(
      {},
      "",
      "/callback?error=access_denied&error_description=ConsentNotGiven&state=tampered-state",
    );
    mockedConsumeLoginCsrf.mockReturnValue("csrf-token");
    mockedVerifyState.mockImplementation(() => {
      throw new Error("Invalid state");
    });

    await act(async () => {
      render(<CallbackPage />);
    });

    expect(mockNavigate).toHaveBeenCalledWith(RoutePath.LoginPage, { replace: true });
    expect(mockedLoginService.login).not.toHaveBeenCalled();
  });

  it("does not navigate to ConsentDeniedPage when error=access_denied but error_description differs", async () => {
    globalThis.history.replaceState(
      {},
      "",
      "/callback?error=access_denied&error_description=SomethingElse",
    );

    await act(async () => {
      render(<CallbackPage />);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockedLoginService.login).not.toHaveBeenCalled();
  });

  it("navigates to LoginPage when CSRF is missing from session storage", async () => {
    globalThis.history.replaceState({}, "", "/callback?code=abc123&state=some-state");
    mockedConsumeLoginCsrf.mockReturnValue(null);

    render(<CallbackPage />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(RoutePath.LoginPage));
    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it("navigates to LoginPage when verifyState throws", async () => {
    globalThis.history.replaceState({}, "", "/callback?code=abc123&state=bad-state");
    mockedConsumeLoginCsrf.mockReturnValue("csrf-token");
    mockedVerifyState.mockImplementation(() => {
      throw new Error("Invalid state");
    });

    render(<CallbackPage />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(RoutePath.LoginPage));
    expect(mockSetUser).not.toHaveBeenCalled();
  });

  it("calls setUser and navigates to returnTo path on successful auth", async () => {
    globalThis.history.replaceState({}, "", "/callback?code=abc123&state=valid-state");
    mockedConsumeLoginCsrf.mockReturnValue("csrf-token");
    mockedVerifyState.mockReturnValue("/get-self-test-kit-for-HIV");

    const mappedUser = {
      sub: "user-123",
      nhsNumber: "9686368973",
      birthdate: "1968-02-12",
      email: "test@example.com",
      identityProofingLevel: "P9",
      phoneNumber: "+447887510886",
      familyName: "MILLAR",
      givenName: "Alice",
    };
    mockedLoginService.login.mockResolvedValue(mappedUser);

    render(<CallbackPage />);

    await waitFor(() => expect(mockSetUser).toHaveBeenCalledWith(mappedUser));
    expect(mockNavigate).toHaveBeenCalledWith("/get-self-test-kit-for-HIV");
    expect(mockedLoginService.login).toHaveBeenCalledWith("abc123");
  });

  it("navigates to GetSelfTestKitPage when returnTo resolves to null", async () => {
    globalThis.history.replaceState({}, "", "/callback?code=abc123&state=valid-state");
    mockedConsumeLoginCsrf.mockReturnValue("csrf-token");
    mockedVerifyState.mockReturnValue(null);

    const mappedUser = {
      sub: "u",
      nhsNumber: "n",
      birthdate: "b",
      email: "e",
      identityProofingLevel: "P9",
      phoneNumber: "p",
      familyName: "F",
      givenName: "G",
    };
    mockedLoginService.login.mockResolvedValue(mappedUser);

    render(<CallbackPage />);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(RoutePath.BeforeYouStartPage));
  });

  it("captures an async error when loginService.login throws", async () => {
    globalThis.history.replaceState({}, "", "/callback?code=abc123&state=valid-state");
    mockedConsumeLoginCsrf.mockReturnValue("csrf-token");
    mockedVerifyState.mockReturnValue("/get-self-test-kit-for-HIV");
    mockedLoginService.login.mockRejectedValue(new Error("HTTP 500: backend failed"));

    render(<CallbackPage />);

    await waitFor(() => expect(mockHandleAsyncError).toHaveBeenCalledTimes(1));

    expect(mockHandleAsyncError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((mockHandleAsyncError.mock.calls[0][0] as Error).message).toBe(
      "HTTP 500: backend failed",
    );
    expect(mockSetUser).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
