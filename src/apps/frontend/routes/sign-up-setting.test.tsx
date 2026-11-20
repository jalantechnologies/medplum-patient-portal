import { MockClient } from "@medplum/mock";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import routes from "../constants/routes";
import { AuthenticationProvider } from "../providers";
import { TestProviders } from "../test-providers";
import { ApplicationRoutes } from "./index";
import { routeObjects } from "./route-objects";

vi.mock("../configuration", () => ({
  configuration: {
    medplumServerAddress: "http://localhost:8103/",
    medplumProjectIdentifier: "test-project",
    isSignUpEnabled: false,
  },
}));

const renderRoutes = (path: string) => {
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  render(
    <TestProviders medplum={new MockClient({ profile: null })}>
      <AuthenticationProvider>
        <ApplicationRoutes router={router} />
      </AuthenticationProvider>
    </TestProviders>,
  );
  return router;
};

describe("ApplicationRoutes with sign-up turned off", () => {
  it("shows the sign-in page without a link to create an account", async () => {
    renderRoutes(routes.SIGN_IN);

    expect(await screen.findByTestId("sign-in")).toBeInTheDocument();
    expect(screen.queryByTestId("create-account-link")).not.toBeInTheDocument();
  });

  it("shows the sign-in page to a visitor who opens the page to create an account", async () => {
    const router = renderRoutes(routes.SIGN_UP);

    expect(await screen.findByTestId("sign-in")).toBeInTheDocument();
    expect(screen.queryByTestId("first-name")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(routes.SIGN_IN);
  });
});
