import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useFocusH1OnNavigation(): void {
  const location = useLocation();

  useEffect(() => {
    const h1 = document.querySelector<HTMLHeadingElement>("h1");
    if (!h1) return;

    h1.setAttribute("tabindex", "-1");
    h1.focus({ preventScroll: true });
  }, [location.pathname]);
}
