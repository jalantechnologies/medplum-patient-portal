import {
  ClientStorage,
  createReference,
  encodeBase64Url,
  MemoryStorage,
  ReadablePromise,
  unauthorized,
  type LoginState,
} from "@medplum/core";
import type { CarePlan, Patient } from "@medplum/fhirtypes";
import { DrAliceSmith, HomerSimpson, MockClient } from "@medplum/mock";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import constant from "../constants";
import routes from "../constants/routes";
import {
  CARE_PLAN_INTENT,
  CARE_PLAN_STATUS,
  RESOURCE_TYPE,
} from "../constants/fhir";
import { AuthenticationProvider } from "../providers";
import { TestProviders } from "../test-providers";
import { ApplicationRoutes } from "./index";
import { routeObjects } from "./route-objects";

const renderRoutes = (medplum: MockClient, path = "/") => {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  render(
    <TestProviders medplum={medplum}>
      <AuthenticationProvider>
        <ApplicationRoutes router={router} />
      </AuthenticationProvider>
    </TestProviders>,
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

const getNavigationLink = (container: HTMLElement, path: string) => {
  const [link] = within(within(container).getByTestId("sidebar-navigation"))
    .getAllByTestId("navigation-link")
    .filter((element) => element.getAttribute("href") === path);
  expect(link).toBeDefined();
  return link;
};

const openNavigationDrawer = async (
  user: ReturnType<typeof userEvent.setup>,
) => {
  await user.click(await screen.findByTestId("open-navigation"));
  return screen.findByTestId("navigation-drawer");
};

const recordWhetherNextClickIsLeftToTheBrowser = () => {
  const record = { isLeftToTheBrowser: false };
  document.addEventListener(
    "click",
    (event) => {
      record.isLeftToTheBrowser = !event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  return record;
};

const createScreenWidth = () =>
  Object.assign(new EventTarget(), {
    matches: false,
    media: "",
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
  });

const tabUntilFocused = async (
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement,
) => {
  for (let step = 0; step < 20 && document.activeElement !== element; step++) {
    await user.tab();
  }
  expect(element).toHaveFocus();
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
      fetch: async () => jsonResponse(401, unauthorized),
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

  it("does not show the previous patient's record to the next patient who signs in on the same device", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: HomerSimpson });
    await medplum.createResource<CarePlan>({
      resourceType: RESOURCE_TYPE.CARE_PLAN,
      status: CARE_PLAN_STATUS.ACTIVE,
      intent: CARE_PLAN_INTENT.PLAN,
      subject: createReference(HomerSimpson),
    });
    vi.spyOn(medplum, "signOut").mockImplementation(async () => {
      medplum.mock.setProfile(undefined);
    });

    renderRoutes(medplum);
    expect(await screen.findByTestId("active-care-plans")).toHaveTextContent(
      "1 ongoing plan",
    );
    await user.click(screen.getByTestId("sign-out"));
    expect(await screen.findByTestId("email")).toBeInTheDocument();

    const nextPatient: Patient = {
      resourceType: RESOURCE_TYPE.PATIENT,
      id: "synthetic-next-patient",
      name: [{ given: ["Riley"], family: "Synthetic" }],
    };
    vi.spyOn(medplum, "processCode").mockImplementation(async () => {
      medplum.mock.setProfile(nextPatient);
      return nextPatient;
    });
    const search = medplum.search.bind(medplum);
    vi.spyOn(medplum, "search").mockImplementation(((
      resourceType,
      query,
      options,
    ) =>
      resourceType === RESOURCE_TYPE.CARE_PLAN
        ? new ReadablePromise(new Promise(() => {}))
        : search(resourceType, query, options)) as typeof medplum.search);
    await signIn(user);

    expect(await screen.findByTestId("home-greeting")).toHaveTextContent(
      "Hello, Riley",
    );
    expect(screen.queryByTestId("active-care-plans")).not.toBeInTheDocument();
    expect(screen.getByTestId("active-care-plans-loading")).toBeInTheDocument();
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
          resourceType: RESOURCE_TYPE.PATIENT,
          id: "synthetic-patient",
          name: [{ family: "Simpson" }],
        },
      }),
    );

    expect(await screen.findByTestId("home-greeting")).toHaveTextContent(
      /^Hello$/,
    );
  });

  it("shows the signed-in patient's name in the sidebar", async () => {
    renderRoutes(new MockClient({ profile: HomerSimpson }));

    const sidebar = await screen.findByTestId("sidebar");
    expect(within(sidebar).getByTestId("account-name")).toHaveTextContent(
      "Homer Simpson",
    );
  });

  it("takes a patient from another page to Home with the keyboard", async () => {
    const user = userEvent.setup();
    const router = renderRoutes(
      new MockClient({ profile: HomerSimpson }),
      "/somewhere-else",
    );

    expect(await screen.findByTestId("not-found")).toBeInTheDocument();
    await tabUntilFocused(user, screen.getByTestId("open-navigation"));
    await user.keyboard("{Enter}");

    const drawer = await screen.findByTestId("navigation-drawer");
    const homeLink = getNavigationLink(drawer, routes.HOME);
    await tabUntilFocused(user, homeLink);
    await user.keyboard("{Enter}");

    expect(await screen.findByTestId("home-greeting")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("opens the navigation from the menu button and closes it after a section is chosen", async () => {
    const user = userEvent.setup();
    const router = renderRoutes(
      new MockClient({ profile: HomerSimpson }),
      "/somewhere-else",
    );

    const openNavigation = await screen.findByTestId("open-navigation");
    expect(openNavigation).toHaveAccessibleName("Open navigation");
    expect(openNavigation).toHaveAttribute("aria-expanded", "false");

    const drawer = await openNavigationDrawer(user);
    expect(drawer).toHaveRole("dialog");
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer).toHaveAccessibleName("Navigation");
    expect(openNavigation).toHaveAttribute("aria-expanded", "true");
    expect(within(drawer).getByTestId("account-name")).toHaveTextContent(
      "Homer Simpson",
    );
    await user.click(getNavigationLink(drawer, routes.HOME));

    expect(await screen.findByTestId("home-greeting")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(routes.HOME);
    await waitFor(() =>
      expect(screen.queryByTestId("navigation-drawer")).not.toBeInTheDocument(),
    );
    expect(openNavigation).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the navigation when the patient chooses the page already open", async () => {
    const user = userEvent.setup();
    const router = renderRoutes(new MockClient({ profile: HomerSimpson }));

    const drawer = await openNavigationDrawer(user);
    await user.click(getNavigationLink(drawer, routes.HOME));

    await waitFor(() =>
      expect(screen.queryByTestId("navigation-drawer")).not.toBeInTheDocument(),
    );
    expect(router.state.location.pathname).toBe(routes.HOME);
  });

  it("stays on the open page without a new history entry when the patient chooses it again", async () => {
    const user = userEvent.setup();
    const router = renderRoutes(new MockClient({ profile: HomerSimpson }));

    const sidebar = await screen.findByTestId("sidebar");
    await user.click(getNavigationLink(sidebar, routes.HOME));

    expect(router.state.location.pathname).toBe(routes.HOME);
    expect(router.state.historyAction).toBe("REPLACE");
  });

  it("leaves a Cmd-click on a section to the browser and keeps the navigation open", async () => {
    const user = userEvent.setup();
    const router = renderRoutes(
      new MockClient({ profile: HomerSimpson }),
      "/somewhere-else",
    );

    const drawer = await openNavigationDrawer(user);
    const click = recordWhetherNextClickIsLeftToTheBrowser();
    await user.keyboard("{Meta>}");
    await user.click(getNavigationLink(drawer, routes.HOME));
    await user.keyboard("{/Meta}");

    expect(click.isLeftToTheBrowser).toBe(true);
    expect(router.state.location.pathname).toBe("/somewhere-else");
    expect(screen.getByTestId("navigation-drawer")).toBeInTheDocument();
  });

  it("marks the section on screen as the current page", async () => {
    renderRoutes(new MockClient({ profile: HomerSimpson }));

    const sidebar = await screen.findByTestId("sidebar");
    expect(getNavigationLink(sidebar, routes.HOME)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("marks no section as the current page on a page outside the navigation", async () => {
    renderRoutes(new MockClient({ profile: HomerSimpson }), "/somewhere-else");

    const sidebar = await screen.findByTestId("sidebar");
    expect(getNavigationLink(sidebar, routes.HOME)).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("closes the navigation when the screen grows wide enough to show the sidebar", async () => {
    const user = userEvent.setup();
    const screenWidth = createScreenWidth();
    vi.spyOn(window, "matchMedia").mockReturnValue(screenWidth);
    renderRoutes(new MockClient({ profile: HomerSimpson }));

    await openNavigationDrawer(user);
    act(() => {
      screenWidth.matches = true;
      screenWidth.dispatchEvent(
        Object.assign(new Event("change"), { matches: true }),
      );
    });

    await waitFor(() =>
      expect(screen.queryByTestId("navigation-drawer")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("open-navigation")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
