import { Navigate, Outlet } from "react-router";

import routes from "../../constants/routes";
import { useAuthenticationContext } from "../../contexts";

export const ProtectedRoute = () => {
  const { isUserAuthenticated } = useAuthenticationContext();
  return isUserAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to={routes.SIGN_IN} replace />
  );
};
