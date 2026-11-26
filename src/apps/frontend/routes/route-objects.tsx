import { Outlet } from "react-router";

import { configuration } from "../configuration";
import routes from "../constants/routes";
import {
  ApplicationError,
  ApplicationLayout,
  HealthProfile,
  HealthRecords,
  Home,
  Medications,
  NotFound,
  PageError,
  SignIn,
  SignUp,
  TestResults,
} from "../pages";
import {
  AllergyIntoleranceProvider,
  AppointmentProvider,
  CarePlanProvider,
  ConditionProvider,
  DiagnosticReportProvider,
  MedicationRequestProvider,
  ObservationProvider,
  ProcedureProvider,
  RecordSourceProvider,
} from "../providers";
import { ProtectedRoute } from "./guards/protected-route";
import { PublicRoute } from "./guards/public-route";

export const routeObjects = [
  {
    errorElement: <ApplicationError />,
    children: [
      {
        element: <PublicRoute />,
        children: [
          { path: routes.SIGN_IN, element: <SignIn /> },
          ...(configuration.isSignUpEnabled
            ? [{ path: routes.SIGN_UP, element: <SignUp /> }]
            : []),
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: (
              <CarePlanProvider>
                <AppointmentProvider>
                  <RecordSourceProvider>
                    <ApplicationLayout>
                      <Outlet />
                    </ApplicationLayout>
                  </RecordSourceProvider>
                </AppointmentProvider>
              </CarePlanProvider>
            ),
            children: [
              {
                errorElement: <PageError />,
                children: [
                  { path: routes.HOME, element: <Home /> },
                  {
                    path: routes.HEALTH_PROFILE,
                    element: (
                      <MedicationRequestProvider>
                        <AllergyIntoleranceProvider>
                          <HealthProfile />
                        </AllergyIntoleranceProvider>
                      </MedicationRequestProvider>
                    ),
                  },
                  {
                    path: routes.MEDICATIONS,
                    element: (
                      <MedicationRequestProvider>
                        <Medications />
                      </MedicationRequestProvider>
                    ),
                  },
                  {
                    path: routes.TEST_RESULTS,
                    element: (
                      <DiagnosticReportProvider>
                        <TestResults />
                      </DiagnosticReportProvider>
                    ),
                  },
                  {
                    path: routes.HEALTH_RECORDS,
                    element: (
                      <ConditionProvider>
                        <AllergyIntoleranceProvider>
                          <ProcedureProvider>
                            <ObservationProvider>
                              <HealthRecords />
                            </ObservationProvider>
                          </ProcedureProvider>
                        </AllergyIntoleranceProvider>
                      </ConditionProvider>
                    ),
                  },
                  { path: "*", element: <NotFound /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
