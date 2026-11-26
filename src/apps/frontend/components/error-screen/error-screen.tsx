import { Block } from "baseui/block";
import type { FC, PropsWithChildren } from "react";

const ErrorScreen: FC<PropsWithChildren> = ({ children }) => (
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
    {children}
  </Block>
);

export default ErrorScreen;
