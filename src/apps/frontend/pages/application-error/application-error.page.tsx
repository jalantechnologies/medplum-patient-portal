import { Button, KIND, SIZE } from "baseui/button";
import { useNavigate } from "react-router";

import { ErrorScreen } from "../../components";
import routes from "../../constants/routes";
import { useAuthenticationContext } from "../../contexts";
import PageError from "../page-error/page-error.page";

export default function ApplicationError() {
  const navigate = useNavigate();
  const { isSignOutLoading, isUserAuthenticated, signOut } =
    useAuthenticationContext();

  const signOutAndShowSignIn = async () => {
    await signOut();
    navigate(routes.SIGN_IN, { replace: true });
  };

  return (
    <ErrorScreen>
      <PageError isRetryFocused>
        {isUserAuthenticated ? (
          <Button
            kind={KIND.tertiary}
            size={SIZE.compact}
            isLoading={isSignOutLoading}
            onClick={signOutAndShowSignIn}
            data-testid="application-error-sign-out"
          >
            Sign out
          </Button>
        ) : null}
      </PageError>
    </ErrorScreen>
  );
}
