import { Block } from "baseui/block";
import { Card } from "baseui/card";
import { HeadingMedium } from "baseui/typography";
import type { FC } from "react";

import SignInForm from "./sign-in-form";

const SignIn: FC = () => (
  <Block
    as="main"
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
    backgroundColor="backgroundSecondary"
    paddingLeft="scale600"
    paddingRight="scale600"
  >
    <Block
      width="100%"
      maxWidth="28rem"
      paddingTop="scale1000"
      paddingBottom="scale1000"
    >
      <Card>
        <HeadingMedium as="h1" marginTop="0" marginBottom="scale800">
          Sign in
        </HeadingMedium>
        <SignInForm />
      </Card>
    </Block>
  </Block>
);

export default SignIn;
