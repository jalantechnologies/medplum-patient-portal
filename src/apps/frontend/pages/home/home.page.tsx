import { formatGivenName } from "@medplum/core";
import { useMedplumProfile } from "@medplum/react-hooks";
import { Block } from "baseui/block";
import { Button, KIND, SIZE } from "baseui/button";
import { HeadingMedium } from "baseui/typography";
import type { FC } from "react";

import { useAuthenticationContext } from "../../contexts";

const Home: FC = () => {
  const profile = useMedplumProfile();
  const { isSignOutLoading, signOut } = useAuthenticationContext();

  const patientName = profile?.name?.[0];
  const givenName = patientName ? formatGivenName(patientName) : "";
  const greeting = givenName ? `Hello, ${givenName}` : "Hello";

  return (
    <Block
      as="main"
      padding="scale800"
      display="grid"
      gridGap="scale800"
      justifyItems="start"
      data-testid="home"
    >
      <HeadingMedium as="h1" margin="0" data-testid="home-greeting">
        {greeting}
      </HeadingMedium>
      <Button
        kind={KIND.secondary}
        size={SIZE.compact}
        isLoading={isSignOutLoading}
        onClick={() => signOut()}
        data-testid="sign-out"
      >
        Sign out
      </Button>
    </Block>
  );
};

export default Home;
