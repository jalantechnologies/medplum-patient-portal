import { MedplumProvider } from "@medplum/react-hooks";
import { BaseProvider, LightTheme } from "baseui";
import { createBrowserRouter } from "react-router";
import { Client as Styletron } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";

import { AuthenticationProvider } from "./providers";
import { ApplicationRoutes } from "./routes";
import { routeObjects } from "./routes/route-objects";
import { MedplumService } from "./services";

const styletronEngine = new Styletron();
const medplumClient = MedplumService.createMedplumClient();
const router = createBrowserRouter(routeObjects);

export default function App() {
  return (
    <StyletronProvider value={styletronEngine}>
      <BaseProvider theme={LightTheme}>
        <MedplumProvider medplum={medplumClient}>
          <AuthenticationProvider>
            <ApplicationRoutes router={router} />
          </AuthenticationProvider>
        </MedplumProvider>
      </BaseProvider>
    </StyletronProvider>
  );
}
