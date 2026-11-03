import type { FC } from "react";
import { RouterProvider, type DataRouter } from "react-router";

import { useAuthenticationContext } from "../contexts";
import { SessionLoading } from "../pages";

interface ApplicationRoutesProperties {
  router: DataRouter;
}

export const ApplicationRoutes: FC<ApplicationRoutesProperties> = ({
  router,
}) => {
  const { isSessionRestoring } = useAuthenticationContext();

  if (isSessionRestoring) {
    return <SessionLoading />;
  }
  return <RouterProvider router={router} />;
};
