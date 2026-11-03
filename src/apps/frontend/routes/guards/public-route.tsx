import { Navigate, Outlet } from "react-router";

import routes from "../../constants/routes";
import { useAuthenticationContext } from "../../contexts";

export const PublicRoute = () => {
  const { isUserAuthenticated } = useAuthenticationContext();
  return isUserAuthenticated ? (
    <Navigate to={routes.HOME} replace />
  ) : (
    <Outlet />
  );
};
