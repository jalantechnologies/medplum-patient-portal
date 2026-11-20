import { badRequest, OperationOutcomeError } from "@medplum/core";
import type { OperationOutcome } from "@medplum/fhirtypes";
import { MockClient } from "@medplum/mock";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import constant from "../../constants";
import { RESOURCE_TYPE } from "../../constants/fhir";
import routes from "../../constants/routes";
import { AuthenticationProvider } from "../../providers";
import { networkFailure, newPatient } from "../../test-medplum";
import { TestProviders } from "../../test-providers";
import SignUpForm from "./sign-up-form";

const renderForm = (medplum: MockClient) =>
  render(
    <TestProviders medplum={medplum}>
      <AuthenticationProvider>
        <MemoryRouter>
          <SignUpForm />
        </MemoryRouter>
      </AuthenticationProvider>
    </TestProviders>,
  );

const fillIn = async (
  user: ReturnType<typeof userEvent.setup>,
  email = "riley@example.com",
) => {
  await user.type(screen.getByTestId("first-name"), "  Riley ");
  await user.type(screen.getByTestId("last-name"), "Synthetic");
  await user.type(screen.getByTestId("email"), email);
  await user.type(screen.getByTestId("password"), "synthetic-password-91");
};

const mockSignUpSteps = (medplum: MockClient) => ({
  startNewUser: vi
    .spyOn(medplum, "startNewUser")
    .mockResolvedValue({ login: "synthetic-login" }),
  startNewPatient: vi
    .spyOn(medplum, "startNewPatient")
    .mockResolvedValue({ login: "synthetic-login", code: "synthetic-code" }),
  processCode: vi.spyOn(medplum, "processCode").mockResolvedValue(newPatient),
});

const combineOutcomes = (
  ...outcomes: [OperationOutcome, ...OperationOutcome[]]
): OperationOutcome => ({
  ...outcomes[0],
  issue: outcomes.flatMap((outcome) => outcome.issue),
});

const mockSignIn = (medplum: MockClient) =>
  vi.spyOn(medplum, "startLogin").mockResolvedValue({
    login: "synthetic-login",
    code: "synthetic-sign-in-code",
  });

const patientAlreadyCreated = () =>
  new OperationOutcomeError(badRequest("Login already has a membership"));

const fieldTestIdentifiers = ["first-name", "last-name", "email", "password"];

const rejectNewUser = (medplum: MockClient, outcome: OperationOutcome) =>
  vi
    .spyOn(medplum, "startNewUser")
    .mockRejectedValue(new OperationOutcomeError(outcome));

describe("SignUpForm", () => {
  it("blocks submission and shows a reason under each empty field", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const { startNewUser } = mockSignUpSteps(medplum);

    renderForm(medplum);
    await user.type(screen.getByTestId("first-name"), "   ");
    await user.click(screen.getByTestId("continue"));

    expect(await screen.findByTestId("first-name-error")).toHaveTextContent(
      constant.FIRST_NAME_VALIDATION_ERROR,
    );
    expect(screen.getByTestId("last-name-error")).toHaveTextContent(
      constant.LAST_NAME_VALIDATION_ERROR,
    );
    expect(screen.getByTestId("email-error")).toHaveTextContent(
      constant.EMAIL_VALIDATION_ERROR,
    );
    expect(screen.getByTestId("password-error")).toHaveTextContent(
      constant.PASSWORD_VALIDATION_ERROR,
    );
    expect(startNewUser).not.toHaveBeenCalled();
  });

  it("creates the account and the patient's record with the typed details, then signs the patient in", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const { startNewUser, startNewPatient, processCode } =
      mockSignUpSteps(medplum);

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    await waitFor(() =>
      expect(processCode).toHaveBeenCalledWith("synthetic-code"),
    );
    expect(startNewUser).toHaveBeenCalledWith({
      email: "riley@example.com",
      firstName: "Riley",
      lastName: "Synthetic",
      password: "synthetic-password-91",
      projectId: "test-project",
    });
    expect(startNewPatient).toHaveBeenCalledWith({
      login: "synthetic-login",
      projectId: "test-project",
    });
    expect(screen.queryByTestId("sign-up-error")).not.toBeInTheDocument();
  });

  it("shows Medplum's reason under the email when it already has an account, with the link to sign in", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    rejectNewUser(medplum, badRequest("Email already registered", "email"));

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    expect(await screen.findByTestId("email-error")).toHaveTextContent(
      "Email already registered",
    );
    expect(screen.getByTestId("email")).toHaveFocus();
    expect(screen.getByTestId("sign-in-link")).toHaveAttribute(
      "href",
      routes.SIGN_IN,
    );
    expect(screen.queryByTestId("sign-up-error")).not.toBeInTheDocument();
  });

  it("shows each of Medplum's reasons under its own field, each once, and focuses the first", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const emailReason = "Valid email address between 3 and 72 characters";
    rejectNewUser(
      medplum,
      combineOutcomes(
        badRequest("Last name is too long", "lastName"),
        badRequest(emailReason, "email"),
        badRequest(emailReason, "email"),
        badRequest("Password found in breach database", "password"),
      ),
    );

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    expect(await screen.findByTestId("last-name-error")).toHaveTextContent(
      "Last name is too long",
    );
    expect(screen.getByTestId("email-error").textContent).toBe(emailReason);
    expect(screen.getByTestId("password-error")).toHaveTextContent(
      "Password found in breach database",
    );
    expect(screen.getByTestId("last-name")).toHaveFocus();
    expect(screen.queryByTestId("sign-up-error")).not.toBeInTheDocument();
  });

  it("announces a reason that names no field", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    rejectNewUser(
      medplum,
      badRequest("Project does not allow open registration"),
    );

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    const signUpError = await screen.findByTestId("sign-up-error");
    expect(signUpError).toHaveAttribute("role", "alert");
    expect(signUpError).toHaveTextContent(
      "Project does not allow open registration",
    );
  });

  it("shows a general message when Medplum cannot be reached", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    vi.spyOn(medplum, "startNewUser").mockRejectedValue(networkFailure());

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    expect(await screen.findByTestId("sign-up-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
  });

  it("removes the previous reasons as soon as the patient submits again", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const startNewUser = rejectNewUser(
      medplum,
      combineOutcomes(
        badRequest("Email already registered", "email"),
        badRequest("Registration is disabled"),
      ),
    );

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));
    expect(await screen.findByTestId("sign-up-error")).toBeInTheDocument();
    expect(screen.getByTestId("email-error")).toHaveTextContent(
      "Email already registered",
    );

    startNewUser.mockReturnValue(new Promise(() => {}));
    await user.click(screen.getByTestId("continue"));

    await waitFor(() =>
      expect(screen.queryByTestId("sign-up-error")).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("email-error")).not.toBeInTheDocument();
  });

  it("keeps the details the account was created with, and finishes that account on the next Continue, when its record could not be created", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const { startNewUser, startNewPatient, processCode } =
      mockSignUpSteps(medplum);
    startNewPatient.mockRejectedValueOnce(networkFailure());

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    const signUpError = await screen.findByTestId("sign-up-error");
    expect(signUpError).toHaveTextContent(constant.INCOMPLETE_SIGN_UP_ERROR);
    expect(signUpError).toHaveTextContent(constant.DEFAULT_ERROR_MESSAGE);
    fieldTestIdentifiers.forEach((testIdentifier) =>
      expect(screen.getByTestId(testIdentifier)).toHaveAttribute("readonly"),
    );
    await user.type(screen.getByTestId("first-name"), "Changed");
    await user.type(screen.getByTestId("email"), "changed");
    await user.type(screen.getByTestId("password"), "changed");
    expect(screen.getByTestId("first-name")).toHaveValue("  Riley ");
    expect(screen.getByTestId("email")).toHaveValue("riley@example.com");
    expect(screen.getByTestId("password")).toHaveValue("synthetic-password-91");

    await user.click(screen.getByTestId("continue"));

    await waitFor(() =>
      expect(processCode).toHaveBeenCalledWith("synthetic-code"),
    );
    expect(startNewUser).toHaveBeenCalledTimes(1);
    expect(startNewPatient).toHaveBeenCalledTimes(2);
    expect(startNewPatient).toHaveBeenLastCalledWith({
      login: "synthetic-login",
      projectId: "test-project",
    });
  });

  it("signs the person in when Medplum created their record but its answer never arrived", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const { startNewPatient, processCode } = mockSignUpSteps(medplum);
    startNewPatient.mockRejectedValue(patientAlreadyCreated());
    const startLogin = mockSignIn(medplum);

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    await waitFor(() =>
      expect(processCode).toHaveBeenCalledWith("synthetic-sign-in-code"),
    );
    expect(startLogin).toHaveBeenCalledWith({
      email: "riley@example.com",
      password: "synthetic-password-91",
      projectId: "test-project",
      resourceType: RESOURCE_TYPE.PATIENT,
    });
    expect(processCode).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("sign-up-error")).not.toBeInTheDocument();
  });

  it("signs the person in on the next Continue when signing in to the new account failed", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const { startNewUser, startNewPatient, processCode } =
      mockSignUpSteps(medplum);
    processCode.mockRejectedValueOnce(networkFailure());
    const startLogin = mockSignIn(medplum);

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));
    expect(await screen.findByTestId("sign-up-error")).toHaveTextContent(
      constant.INCOMPLETE_SIGN_UP_ERROR,
    );

    startNewPatient.mockRejectedValue(patientAlreadyCreated());
    await user.click(screen.getByTestId("continue"));

    await waitFor(() =>
      expect(processCode).toHaveBeenLastCalledWith("synthetic-sign-in-code"),
    );
    expect(startNewUser).toHaveBeenCalledTimes(1);
    expect(startLogin).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("sign-up-error")).not.toBeInTheDocument();
  });

  it("says so when the new account needs a sign-in step the portal does not support", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const { startNewPatient, processCode } = mockSignUpSteps(medplum);
    startNewPatient.mockResolvedValue({ login: "synthetic-login" });

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    expect(await screen.findByTestId("sign-up-error")).toHaveTextContent(
      constant.UNSUPPORTED_SIGN_IN_STEP_ERROR,
    );
    expect(processCode).not.toHaveBeenCalled();
  });

  it("leaves no session behind when signing in to the new account fails", async () => {
    const user = userEvent.setup();
    const medplum = new MockClient({ profile: null });
    const { processCode } = mockSignUpSteps(medplum);
    processCode.mockRejectedValue(networkFailure());
    const clear = vi.spyOn(medplum, "clear");

    renderForm(medplum);
    await fillIn(user);
    await user.click(screen.getByTestId("continue"));

    expect(await screen.findByTestId("sign-up-error")).toHaveTextContent(
      constant.DEFAULT_ERROR_MESSAGE,
    );
    expect(clear).toHaveBeenCalledTimes(1);
  });
});
