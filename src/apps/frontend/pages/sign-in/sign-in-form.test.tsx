import { HomerSimpson, MockClient } from "@medplum/mock";
import { MedplumProvider } from "@medplum/react-hooks";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BaseProvider, LightTheme } from "baseui";
import type { PropsWithChildren } from "react";
import { Client as Styletron } from "styletron-engine-monolithic";
import { Provider as StyletronProvider } from "styletron-react";
import { describe, expect, it, vi } from "vitest";

import constant from "../../constants";
import { AuthenticationProvider } from "../../providers";
import SignInForm from "./sign-in-form";

const renderForm = (medplum: MockClient) => {
  const wrapper = ({ children }: PropsWithChildren) => (
    <StyletronProvider value={new Styletron()}>
      <BaseProvider theme={LightTheme}>
        <MedplumProvider medplum={medplum}>
          <AuthenticationProvider>{children}</AuthenticationProvider>
        </MedplumProvider>
      </BaseProvider>
    </StyletronProvider>
  );

  return render(<SignInForm />, { wrapper });
};

const submitCredentials = async (
  user: ReturnType<typeof userEvent.setup>,
  password: string,
) => {
  await user.type(screen.getByTestId("email"), "patient@example.com");
  await user.type(screen.getByTestId("password"), password);
  await user.click(screen.getByTestId("sign-in"));
};

describe("SignInForm", () => {
  it("blocks submission and shows validation errors for empty fields", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const startLogin = vi.spyOn(medplum, "startLogin");

    renderForm(medplum);

    await user.click(screen.getByTestId("sign-in"));

    expect(await screen.findByTestId("email-error")).toHaveTextContent(
      constant.EMAIL_VALIDATION_ERROR,
    );
    expect(screen.getByTestId("password-error")).toHaveTextContent(
      constant.PASSWORD_VALIDATION_ERROR,
    );
    expect(startLogin).not.toHaveBeenCalled();
  });

  it("signs a patient in with the typed credentials", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const startLogin = vi.spyOn(medplum, "startLogin");
    const processCode = vi
      .spyOn(medplum, "processCode")
      .mockResolvedValue(HomerSimpson);

    renderForm(medplum);

    await submitCredentials(user, "password");

    await waitFor(() => expect(processCode).toHaveBeenCalledTimes(1));
    expect(startLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "patient@example.com",
        password: "password",
        projectId: "test-project",
        resourceType: "Patient",
      }),
    );
    expect(screen.queryByTestId("sign-in-error")).not.toBeInTheDocument();
  });

  it("announces Medplum's reason when it rejects the credentials", async () => {
    const user = userEvent.setup();

    renderForm(new MockClient({ profile: null }));

    await submitCredentials(user, "wrong-password");

    const signInError = await screen.findByTestId("sign-in-error");
    expect(signInError).toHaveAttribute("role", "alert");
    expect(signInError).toHaveTextContent("Invalid password");
  });

  it("removes the previous error as soon as the patient submits again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });

    renderForm(medplum);

    await submitCredentials(user, "wrong-password");
    expect(await screen.findByTestId("sign-in-error")).toBeInTheDocument();

    vi.spyOn(medplum, "startLogin").mockReturnValue(new Promise(() => {}));
    await user.click(screen.getByTestId("sign-in"));

    await waitFor(() =>
      expect(screen.queryByTestId("sign-in-error")).not.toBeInTheDocument(),
    );
  });

  it("shows a general message when Medplum cannot be reached", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    vi.spyOn(medplum, "startLogin").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    renderForm(medplum);

    await submitCredentials(user, "password");

    expect(await screen.findByTestId("sign-in-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
  });

  it("says so when the account needs a sign-in step the portal does not support", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    vi.spyOn(medplum, "startLogin").mockResolvedValue({ login: "login" });

    renderForm(medplum);

    await submitCredentials(user, "password");

    expect(await screen.findByTestId("sign-in-error")).toHaveTextContent(
      constant.UNSUPPORTED_SIGN_IN_STEP_ERROR,
    );
  });
});
