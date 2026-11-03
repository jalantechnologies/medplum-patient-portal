import routes from "../constants/routes";
import { Home, NotFound, SignIn } from "../pages";
import { ProtectedRoute } from "./guards/protected-route";
import { PublicRoute } from "./guards/public-route";

export const routeObjects = [
  {
    element: <PublicRoute />,
    children: [{ path: routes.SIGN_IN, element: <SignIn /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: routes.HOME, element: <Home /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];
