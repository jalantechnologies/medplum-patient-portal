import type { MedplumClient } from "@medplum/core";
import { MedplumProvider } from "@medplum/react-hooks";
import { BaseProvider, LightTheme } from "baseui";
import { createBrowserRouter } from "react-router";
import { Client as Styletron } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";

import { ApplicationErrorBoundary } from "./components";
import { AuthenticationProvider } from "./providers";
import { ApplicationRoutes } from "./routes";
import { routeObjects } from "./routes/route-objects";
import { MedplumService } from "./services";

const styletronEngine = new Styletron();
const router = createBrowserRouter(routeObjects);
let medplumClient: MedplumClient | undefined;

function MedplumSession() {
  medplumClient ??= MedplumService.createMedplumClient();

  return (
    <MedplumProvider medplum={medplumClient}>
      <AuthenticationProvider>
        <ApplicationRoutes router={router} />
      </AuthenticationProvider>
    </MedplumProvider>
  );
}

export default function App() {
  return (
    <StyletronProvider value={styletronEngine}>
      <BaseProvider theme={LightTheme}>
        <ApplicationErrorBoundary>
          <MedplumSession />
        </ApplicationErrorBoundary>
      </BaseProvider>
    </StyletronProvider>
  );
}
