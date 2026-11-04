import { Outlet } from "react-router";

import routes from "../constants/routes";
import { ApplicationLayout, Home, NotFound, SignIn } from "../pages";
import { AppointmentProvider, CarePlanProvider } from "../providers";
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
      {
        element: (
          <CarePlanProvider>
            <AppointmentProvider>
              <ApplicationLayout>
                <Outlet />
              </ApplicationLayout>
            </AppointmentProvider>
          </CarePlanProvider>
        ),
        children: [
          { path: routes.HOME, element: <Home /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
];
