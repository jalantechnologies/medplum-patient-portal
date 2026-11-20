import { OperationOutcomeError, type ProfileResource } from "@medplum/core";

import { configuration } from "../../configuration";
import constant from "../../constants";
import { RESOURCE_TYPE } from "../../constants/fhir";
import {
  AsynchronousOperationError,
  IncompleteSignUpError,
  ServiceResponse,
  type SignUpParameters,
} from "../../types";
import MedplumService from "../medplum/medplum.service";

export default class AuthenticationService extends MedplumService {
  restoreSession = async (): Promise<void> => {
    await this.medplumClient.getInitPromise();
    try {
      await this.medplumClient.getProfileAsync();
    } catch {
      // Medplum logs why the stored session failed; an expired or unreachable session only means the patient signs in again.
    }
  };

  signIn = async (
    email: string,
    password: string,
  ): Promise<ServiceResponse<ProfileResource>> => {
    const loginResponse = await this.medplumClient.startLogin({
      email,
      password,
      projectId: configuration.medplumProjectIdentifier,
      resourceType: RESOURCE_TYPE.PATIENT,
    });
    return this.exchangeCode(loginResponse.code);
  };

  signUp = async (
    parameters: SignUpParameters,
  ): Promise<ServiceResponse<ProfileResource>> => {
    const loginIdentifier =
      parameters.loginIdentifier ?? (await this.createUser(parameters));
    try {
      return await this.createPatientAndSignIn(parameters, loginIdentifier);
    } catch (thrown) {
      throw new IncompleteSignUpError(
        loginIdentifier,
        AsynchronousOperationError.fromUnknown(
          thrown,
          constant.DEFAULT_ERROR_MESSAGE,
        ),
      );
    }
  };

  signOut = async (): Promise<ServiceResponse<void>> => {
    try {
      await this.medplumClient.signOut();
    } catch (error) {
      // The session must end on this device even when the server cannot be reached to revoke it.
      console.error(error);
      this.medplumClient.clear();
    }
    return new ServiceResponse<void>();
  };

  private async createUser({
    email,
    firstName,
    lastName,
    password,
  }: SignUpParameters): Promise<string> {
    const userResponse = await this.medplumClient.startNewUser({
      email,
      firstName,
      lastName,
      password,
      projectId: configuration.medplumProjectIdentifier,
    });
    return userResponse.login;
  }

  private async createPatientAndSignIn(
    { email, password }: SignUpParameters,
    loginIdentifier: string,
  ): Promise<ServiceResponse<ProfileResource>> {
    try {
      const patientResponse = await this.medplumClient.startNewPatient({
        login: loginIdentifier,
        projectId: configuration.medplumProjectIdentifier,
      });
      return await this.exchangeCode(patientResponse.code);
    } catch (thrown) {
      if (this.isPatientAlreadyCreated(thrown)) {
        return this.signIn(email, password);
      }
      throw thrown;
    }
  }

  private isPatientAlreadyCreated(thrown: unknown): boolean {
    return (
      thrown instanceof OperationOutcomeError &&
      (thrown.outcome.issue ?? []).some(
        (issue) => issue.details?.text === constant.LOGIN_HAS_MEMBERSHIP_REASON,
      )
    );
  }

  private async exchangeCode(
    code: string | undefined,
  ): Promise<ServiceResponse<ProfileResource>> {
    if (!code) {
      throw new AsynchronousOperationError(
        constant.UNSUPPORTED_SIGN_IN_STEP_ERROR,
      );
    }
    try {
      const profile = await this.medplumClient.processCode(code);
      return new ServiceResponse(profile);
    } catch (error) {
      this.medplumClient.clear();
      throw error;
    }
  }
}
