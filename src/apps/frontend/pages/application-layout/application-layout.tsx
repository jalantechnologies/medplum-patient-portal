import type { FC, PropsWithChildren } from "react";

import { ApplicationShell } from "../../components";
import routes from "../../constants/routes";
import { useAuthenticationContext } from "../../contexts";
import { usePatientName } from "../../hooks";

const navigationItems = [
  { title: "Home", itemId: routes.HOME },
  { title: "Health profile", itemId: routes.HEALTH_PROFILE },
  { title: "Medications", itemId: routes.MEDICATIONS },
  { title: "Health records", itemId: routes.HEALTH_RECORDS },
];

const ApplicationLayout: FC<PropsWithChildren> = ({ children }) => {
  const { fullName } = usePatientName();
  const { isSignOutLoading, signOut } = useAuthenticationContext();

  return (
    <ApplicationShell
      brand="Patient portal"
      navigationItems={navigationItems}
      patientName={fullName}
      isSignOutLoading={isSignOutLoading}
      onSignOut={() => signOut()}
    >
      {children}
    </ApplicationShell>
  );
};

export default ApplicationLayout;
