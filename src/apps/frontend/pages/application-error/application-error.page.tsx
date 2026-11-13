import { Block } from "baseui/block";
import { Button, KIND, SIZE } from "baseui/button";
import { useNavigate } from "react-router";

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
    <Block
      as="main"
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      paddingLeft="scale600"
      paddingRight="scale600"
      data-testid="application-error"
    >
      <PageError>
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
    </Block>
  );
}
