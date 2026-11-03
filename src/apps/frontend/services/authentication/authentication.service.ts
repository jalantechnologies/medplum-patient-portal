import type { ProfileResource } from "@medplum/core";

import { configuration } from "../../configuration";
import constant from "../../constants";
import { AsynchronousOperationError, ServiceResponse } from "../../types";
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
      resourceType: constant.PATIENT_RESOURCE_TYPE,
    });
    if (!loginResponse.code) {
      throw new AsynchronousOperationError(
        constant.UNSUPPORTED_SIGN_IN_STEP_ERROR,
      );
    }
    try {
      const profile = await this.medplumClient.processCode(loginResponse.code);
      return new ServiceResponse(profile);
    } catch (error) {
      this.medplumClient.clear();
      throw error;
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
}
