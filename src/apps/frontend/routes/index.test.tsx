import {
  ClientStorage,
  encodeBase64Url,
  MemoryStorage,
  type LoginState,
} from "@medplum/core";
import { DrAliceSmith, HomerSimpson, MockClient } from "@medplum/mock";
import { MedplumProvider } from "@medplum/react-hooks";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BaseProvider, LightTheme } from "baseui";
import { createMemoryRouter } from "react-router";
import { Client as Styletron } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";
import { describe, expect, it, vi } from "vitest";

import constant from "../constants";
import { AuthenticationProvider } from "../providers";
import { ApplicationRoutes } from "./index";
import { routeObjects } from "./route-objects";

const renderRoutes = (medplum: MockClient, path = "/") => {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  render(
    <StyletronProvider value={new Styletron()}>
      <BaseProvider theme={LightTheme}>
        <MedplumProvider medplum={medplum}>
          <AuthenticationProvider>
            <ApplicationRoutes router={router} />
          </AuthenticationProvider>
        </MedplumProvider>
      </BaseProvider>
    </StyletronProvider>,
  );
  return router;
};

const createMedplumAccessToken = (secondsUntilExpiry: number) =>
  [
    { alg: "none" },
    {
      login_id: "synthetic-login",
      exp: Math.floor(Date.now() / 1000) + secondsUntilExpiry,
    },
  ]
    .map((part) => encodeBase64Url(JSON.stringify(part)))
    .concat("synthetic-signature")
    .join(".");

const createStoredSession = (accessToken: string) => {
  const storage = new ClientStorage(new MemoryStorage());
  const login: LoginState = {
    accessToken,
    refreshToken: "",
    project: { reference: "Project/synthetic-project" },
    profile: { reference: "Patient/synthetic-patient" },
  };
  storage.setObject("activeLogin", login);
  return storage;
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const networkFailure = () => new TypeError("Failed to fetch");

const signIn = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByTestId("email"), "patient@example.com");
  await user.type(screen.getByTestId("password"), "password");
  await user.click(screen.getByTestId("sign-in"));
};

describe("ApplicationRoutes", () => {
  it("shows the sign-in page to a visitor", async () => {
    const router = renderRoutes(new MockClient({ profile: null }));

    expect(await screen.findByTestId("email")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/sign-in");
  });

  it("shows the sign-in page when the stored session belongs to staff, not a patient", async () => {
    renderRoutes(new MockClient({ profile: DrAliceSmith }));

    expect(await screen.findByTestId("email")).toBeInTheDocument();
  });

  it("shows the sign-in page when the stored session has expired", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const medplum = new MockClient({
      profile: null,
      storage: createStoredSession(createMedplumAccessToken(-60)),
      fetch: async () =>
        jsonResponse(401, {
          resourceType: "OperationOutcome",
          issue: [{ severity: "error", code: "login" }],
        }),
    });

    renderRoutes(medplum);

    expect(await screen.findByTestId("email")).toBeInTheDocument();
    expect(screen.queryByTestId("session-loading")).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("sends a signed-in patient who opens the sign-in page to Home", async () => {
    const router = renderRoutes(
      new MockClient({ profile: HomerSimpson }),
      "/sign-in",
    );

    expect(await screen.findByTestId("home-greeting")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("takes a patient from the sign-in page to Home without adding a history entry", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    vi.spyOn(medplum, "processCode").mockImplementation(async () => {
      medplum.mock.setProfile(HomerSimpson);
      return HomerSimpson;
    });

    const router = renderRoutes(medplum);
    await signIn(user);

    expect(await screen.findByTestId("home-greeting")).toHaveTextContent(
      "Hello, Homer",
    );
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("keeps the sign-in page on screen while Medplum loads the profile", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const processCode = vi
      .spyOn(medplum, "processCode")
      .mockImplementation(() => {
        vi.spyOn(medplum, "isLoading").mockReturnValue(true);
        medplum.dispatchEvent({ type: "profileRefreshing" });
        return new Promise(() => {});
      });

    renderRoutes(medplum);
    await signIn(user);

    await waitFor(() => expect(processCode).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("sign-in")).toBeInTheDocument();
    expect(screen.queryByTestId("session-loading")).not.toBeInTheDocument();
  });

  it("shows the error and keeps no session when the profile cannot be loaded after the password is accepted", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({
      profile: null,
      fetch: async (url: string) => {
        if (url.endsWith("auth/login")) {
          return jsonResponse(200, {
            login: "synthetic-login",
            code: "synthetic-code",
          });
        }
        if (url.endsWith("oauth2/token")) {
          return jsonResponse(200, {
            access_token: createMedplumAccessToken(3600),
            token_type: "Bearer",
            project: { reference: "Project/synthetic-project" },
            profile: { reference: "Patient/synthetic-patient" },
          });
        }
        throw networkFailure();
      },
    });

    renderRoutes(medplum);
    await signIn(user);

    expect(await screen.findByTestId("sign-in-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(screen.queryByTestId("session-loading")).not.toBeInTheDocument();
    expect(medplum.getActiveLogin()).toBeUndefined();
  });

  it("shows Home to a signed-in patient and returns to sign-in after signing out", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    vi.spyOn(medplum, "signOut").mockImplementation(async () => {
      medplum.mock.setProfile(undefined);
    });

    const router = renderRoutes(medplum);

    expect(await screen.findByTestId("home-greeting")).toHaveTextContent(
      "Hello, Homer",
    );
    expect(router.state.location.pathname).toBe("/");
    await user.click(screen.getByTestId("sign-out"));
    expect(await screen.findByTestId("email")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/sign-in");
  });

  it("ends the session on this device when the sign-out request fails", async () => {
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const medplum = new MockClient({
      profile: HomerSimpson,
      storage: createStoredSession("synthetic-access-token"),
      fetch: async () => {
        throw networkFailure();
      },
    });

    renderRoutes(medplum);
    await user.click(await screen.findByTestId("sign-out"));

    await waitFor(() => expect(medplum.getActiveLogin()).toBeUndefined());
    expect(medplum.getAccessToken()).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(expect.any(TypeError));
  });

  it("greets a patient whose name has no given part without a trailing comma", async () => {
    renderRoutes(
      new MockClient({
        profile: {
          resourceType: "Patient",
          id: "synthetic-patient",
          name: [{ family: "Simpson" }],
        },
      }),
    );

    expect(await screen.findByTestId("home-greeting")).toHaveTextContent(
      /^Hello$/,
    );
  });
});
