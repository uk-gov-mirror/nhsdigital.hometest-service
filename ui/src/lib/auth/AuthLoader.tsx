"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import PageLayout from "@/layouts/PageLayout";
import { RoutePath } from "@/lib/models/route-paths";
import { useAuth } from "@/state";

import { SessionUnauthenticatedError, fetchSessionUser } from "./fetchSessionUser";

const publicRoutes = new Set<string>([
  RoutePath.LoginPage,
  RoutePath.CallbackPage,
  RoutePath.ServiceErrorPage,
  RoutePath.ConsentDeniedPage,
]);

function getReturnTo(location: ReturnType<typeof useLocation>): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function AuthLoader({ children }: Readonly<{ children?: ReactNode }>) {
  const { setUser, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authError, setAuthError] = useState<Error | null>(null);
  const isPublicRoute = publicRoutes.has(location.pathname);

  useEffect(() => {
    if (isPublicRoute || user) {
      return;
    }

    let isCancelled = false;

    const checkSession = async () => {
      try {
        const sessionUser = await fetchSessionUser();
        if (!isCancelled) {
          setUser(sessionUser);
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }

        if (error instanceof SessionUnauthenticatedError) {
          const returnTo = getReturnTo(location);
          navigate(`${RoutePath.LoginPage}?returnTo=${encodeURIComponent(returnTo)}`, {
            replace: true,
          });
          return;
        }

        setAuthError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void checkSession();

    return () => {
      isCancelled = true;
    };
  }, [isPublicRoute, location, navigate, setUser, user]);

  if (authError) {
    throw authError;
  }

  if (isPublicRoute || user) {
    return <>{children ?? <Outlet />}</>;
  }

  return (
    <PageLayout>
      <div role="status" aria-live="polite">
        <h1 className="nhsuk-heading-l">Loading page</h1>
        <p className="nhsuk-body">Please wait while we prepare the page.</p>
      </div>
    </PageLayout>
  );
}
