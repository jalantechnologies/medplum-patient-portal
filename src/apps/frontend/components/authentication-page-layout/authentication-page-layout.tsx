import { Block } from "baseui/block";
import { Card } from "baseui/card";
import { HeadingMedium } from "baseui/typography";
import type { FC, PropsWithChildren } from "react";

interface AuthenticationPageLayoutProperties {
  title: string;
}

const AuthenticationPageLayout: FC<
  PropsWithChildren<AuthenticationPageLayoutProperties>
> = ({ children, title }) => (
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
          {title}
        </HeadingMedium>
        {children}
      </Card>
    </Block>
  </Block>
);

export default AuthenticationPageLayout;
