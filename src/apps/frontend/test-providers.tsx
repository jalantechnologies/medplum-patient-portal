import type { MockClient } from "@medplum/mock";
import { MedplumProvider } from "@medplum/react-hooks";
import { BaseProvider, LightTheme } from "baseui";
import { useState, type FC, type PropsWithChildren } from "react";
import { Client as Styletron } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";

interface TestProvidersProperties {
  medplum: MockClient;
}

export const TestProviders: FC<PropsWithChildren<TestProvidersProperties>> = ({
  children,
  medplum,
}) => {
  const [styletronEngine] = useState(() => new Styletron());

  return (
    <StyletronProvider value={styletronEngine}>
      <BaseProvider theme={LightTheme}>
        <MedplumProvider medplum={medplum}>{children}</MedplumProvider>
      </BaseProvider>
    </StyletronProvider>
  );
};
