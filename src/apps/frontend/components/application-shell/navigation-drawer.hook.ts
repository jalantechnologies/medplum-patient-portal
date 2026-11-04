import { useStyletron } from "baseui";
import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import type { Nullable } from "../../types";

const useNavigationDrawer = () => {
  const [, theme] = useStyletron();
  const location = useLocation();
  const [openedAtLocationKey, setOpenedAtLocationKey] =
    useState<Nullable<string>>(null);

  useEffect(() => {
    const largeScreen = window.matchMedia(
      `screen and (min-width: ${theme.breakpoints.large}px)`,
    );
    const closeOnLargeScreen = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setOpenedAtLocationKey(null);
      }
    };
    largeScreen.addEventListener("change", closeOnLargeScreen);
    return () => largeScreen.removeEventListener("change", closeOnLargeScreen);
  }, [theme.breakpoints.large]);

  // Choosing a section gives a new location key, which closes the drawer; a click the browser handles itself, such as Cmd-click for a new tab, leaves it open.
  const isNavigationOpen = openedAtLocationKey === location.key;

  return {
    closeNavigation: () => setOpenedAtLocationKey(null),
    isNavigationOpen,
    openNavigation: () => setOpenedAtLocationKey(location.key),
  };
};

export default useNavigationDrawer;
