import {
  createReference,
  escapeSearchValue,
  formatSearchQuery,
  getReferenceString,
  isResource,
  type MedplumClient,
  normalizeErrorString,
  Operator,
  type SearchRequest,
  type WithId,
} from "@medplum/core";
import type {
  AccessPolicy,
  Bundle,
  Patient,
  Project,
  ProjectMembership,
  Reference,
  User,
} from "@medplum/fhirtypes";

import {
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  USER_MULTI_FACTOR_AUTHENTICATION_METHOD,
} from "../src/apps/frontend/constants/fhir.ts";
import {
  assertEveryEntrySucceeded,
  findPatient,
  moveDatesToDay,
  type PatientName,
  readPatientName,
} from "./example-data.ts";

export interface ExampleSettings {
  clientIdentifier: string;
  clientSecret: string;
  patientEmail: string;
  patientPassword: string;
  portalProjectIdentifier: string;
  serverAddress: string;
}

export interface LoadExampleDataParameters {
  bundle: Bundle;
  day: Temporal.PlainDate;
  medplumClient: MedplumClient;
  report: (message: string) => void;
  settings: ExampleSettings;
}

interface ReadSettingsParameters {
  environment: Record<string, string | undefined>;
  mode: string;
}

interface AccountParameters {
  medplumClient: MedplumClient;
  patient: WithId<Patient>;
  patientName: PatientName;
  project: WithId<Project>;
  settings: ExampleSettings;
}

interface SignInParameters {
  medplumClient: MedplumClient;
  membership: WithId<ProjectMembership>;
  project: WithId<Project>;
  settings: ExampleSettings;
}

interface MultiFactorAuthenticationResetParameters extends SignInParameters {
  user: User;
}

export const DEVELOPMENT_MODE = "development";

const DEVELOPMENT_SETTINGS_FILE = ".env.local";

const SET_PASSWORD_PATH = "admin/projects/setpassword";

const VARIABLE_NAME = {
  CLIENT_IDENTIFIER: "MEDPLUM_CLIENT_IDENTIFIER",
  CLIENT_SECRET: "MEDPLUM_CLIENT_SECRET",
  PATIENT_EMAIL: "EXAMPLE_PATIENT_EMAIL",
  PATIENT_PASSWORD: "EXAMPLE_PATIENT_PASSWORD",
  PROJECT_IDENTIFIER: "VITE_MEDPLUM_PROJECT_IDENTIFIER",
  SERVER_ADDRESS: "VITE_MEDPLUM_SERVER_ADDRESS",
} as const;

const ACCOUNT_INVITED_MESSAGE = "Invited the example patient.";
const ACCOUNT_FOUND_MESSAGE = "The example patient already has an account.";
const MULTI_FACTOR_AUTHENTICATION_RESET_MESSAGE =
  "Turned off the multi-factor authentication on her account.";
const PASSWORD_SET_MESSAGE = `Set her password to ${VARIABLE_NAME.PATIENT_PASSWORD}.`;
const SIGN_IN_INSTRUCTION = `Sign in to the portal with ${VARIABLE_NAME.PATIENT_EMAIL} and ${VARIABLE_NAME.PATIENT_PASSWORD}.`;

const nameSettingsFile = (mode: string): string =>
  mode === DEVELOPMENT_MODE ? DEVELOPMENT_SETTINGS_FILE : `.env.${mode}.local`;

export const readSettings = ({
  environment,
  mode,
}: ReadSettingsParameters): ExampleSettings => {
  const readRequiredVariable = (name: string): string => {
    const value = environment[name];
    if (!value) {
      throw new Error(
        `Set ${name} in ${nameSettingsFile(mode)}. The README's "Example data" section says what it holds.`,
      );
    }
    return value;
  };
  return {
    clientIdentifier: readRequiredVariable(VARIABLE_NAME.CLIENT_IDENTIFIER),
    clientSecret: readRequiredVariable(VARIABLE_NAME.CLIENT_SECRET),
    patientEmail: readRequiredVariable(VARIABLE_NAME.PATIENT_EMAIL),
    patientPassword: readRequiredVariable(VARIABLE_NAME.PATIENT_PASSWORD),
    portalProjectIdentifier: readRequiredVariable(
      VARIABLE_NAME.PROJECT_IDENTIFIER,
    ),
    serverAddress: readRequiredVariable(VARIABLE_NAME.SERVER_ADDRESS),
  };
};

const readPortalProject = async (
  medplumClient: MedplumClient,
  portalProjectIdentifier: string,
): Promise<WithId<Project>> => {
  const projectIdentifier = medplumClient.getProject()?.id;
  if (projectIdentifier !== portalProjectIdentifier) {
    throw new Error(
      `The client application belongs to project ${projectIdentifier}, not to the portal's project ${portalProjectIdentifier} in ${VARIABLE_NAME.PROJECT_IDENTIFIER}. Create the client in the portal's project.`,
    );
  }
  return medplumClient.readResource(RESOURCE_TYPE.PROJECT, projectIdentifier);
};

const findPatientAccessPolicy = (
  project: Project,
): Reference<AccessPolicy> | undefined =>
  project.defaultAccessPolicies?.find(
    ({ profileType }) => profileType === RESOURCE_TYPE.PATIENT,
  )?.accessPolicy ?? project.defaultPatientAccessPolicy;

const assertPatientsGetAccessPolicy = (project: Project): void => {
  if (!findPatientAccessPolicy(project)) {
    throw new Error(
      `Project ${project.name} gives invited patients no access policy, so the example patient could read every record in it. Set the portal's policy up as the README's "Patient access" section describes, then load again.`,
    );
  }
};

const hasAccessPolicy = ({
  accessPolicy,
  access,
}: ProjectMembership): boolean => Boolean(accessPolicy || access?.length);

const assertMembershipHasAccessPolicy = (
  membership: ProjectMembership,
): void => {
  if (!hasAccessPolicy(membership)) {
    throw new Error(
      `The example patient's records loaded, but her account has no access policy, so she can read every record in the project. Give her project membership the portal's policy, as the README's "Patient access" section describes, then load again.`,
    );
  }
};

const findMembership = async (
  medplumClient: MedplumClient,
  patient: WithId<Patient>,
): Promise<WithId<ProjectMembership> | undefined> => {
  const searchRequest: SearchRequest<ProjectMembership> = {
    resourceType: RESOURCE_TYPE.PROJECT_MEMBERSHIP,
    filters: [
      {
        code: SEARCH_PARAMETER.PROFILE,
        operator: Operator.EQUALS,
        value: getReferenceString(patient),
      },
    ],
  };
  return medplumClient.searchOne(
    searchRequest.resourceType,
    formatSearchQuery(searchRequest),
  );
};

const findProjectUser = async (
  medplumClient: MedplumClient,
  project: WithId<Project>,
  email: string,
): Promise<WithId<User> | undefined> => {
  const searchRequest: SearchRequest<User> = {
    resourceType: RESOURCE_TYPE.USER,
    filters: [
      {
        code: SEARCH_PARAMETER.EMAIL,
        operator: Operator.EXACT,
        value: escapeSearchValue(email.toLowerCase()),
      },
      {
        code: SEARCH_PARAMETER.PROJECT,
        operator: Operator.EQUALS,
        value: getReferenceString(project),
      },
    ],
  };
  return medplumClient.searchOne(
    searchRequest.resourceType,
    formatSearchQuery(searchRequest),
  );
};

const findAccountUser = async ({
  medplumClient,
  membership,
  project,
  settings,
}: SignInParameters): Promise<WithId<User>> => {
  const user = await findProjectUser(
    medplumClient,
    project,
    settings.patientEmail,
  );
  if (!user || membership.user.reference !== getReferenceString(user)) {
    throw new Error(
      `The example patient's account does not belong to the user with ${VARIABLE_NAME.PATIENT_EMAIL} in project ${project.name}, so her sign-in was left as it is. Set ${VARIABLE_NAME.PATIENT_EMAIL} back to her account's email, or remove her project membership so that the next load invites her with ${VARIABLE_NAME.PATIENT_EMAIL}.`,
    );
  }
  return user;
};

const buildMultiFactorAuthenticationResetPath = (
  project: WithId<Project>,
  membership: WithId<ProjectMembership>,
): string => `admin/projects/${project.id}/members/${membership.id}/mfa/reset`;

const listMultiFactorAuthenticationMethods = (
  user: User,
): NonNullable<User["mfaMethod"]> => {
  if (user.mfaMethod?.length) {
    return user.mfaMethod;
  }
  return user.mfaEnrolled ? [USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP] : [];
};

const resetMultiFactorAuthentication = async ({
  medplumClient,
  membership,
  project,
  user,
}: MultiFactorAuthenticationResetParameters): Promise<boolean> => {
  const methods = listMultiFactorAuthenticationMethods(user);
  // Each reset rewrites the user's remaining methods, so the resets run one at a time.
  for (const method of methods) {
    await medplumClient.post(
      buildMultiFactorAuthenticationResetPath(project, membership),
      { method },
    );
  }
  return methods.length > 0;
};

const setPassword = async ({
  medplumClient,
  settings,
}: SignInParameters): Promise<void> => {
  try {
    await medplumClient.post(SET_PASSWORD_PATH, {
      email: settings.patientEmail,
      password: settings.patientPassword,
    });
  } catch (error) {
    throw new Error(
      `Medplum did not set the example patient's password to ${VARIABLE_NAME.PATIENT_PASSWORD}, and answered: ${normalizeErrorString(error)}. If it found the password in a breach database, choose another one, then load again.`,
      { cause: error },
    );
  }
};

const restoreSignIn = async (
  parameters: SignInParameters,
): Promise<string[]> => {
  const user = await findAccountUser(parameters);
  const multiFactorAuthenticationWasReset =
    await resetMultiFactorAuthentication({ ...parameters, user });
  await setPassword(parameters);
  return multiFactorAuthenticationWasReset
    ? [MULTI_FACTOR_AUTHENTICATION_RESET_MESSAGE, PASSWORD_SET_MESSAGE]
    : [PASSWORD_SET_MESSAGE];
};

const invitePatient = async ({
  medplumClient,
  patient,
  patientName,
  project,
  settings,
}: AccountParameters): Promise<WithId<ProjectMembership>> => {
  const invitation = await medplumClient.invite(project.id, {
    resourceType: RESOURCE_TYPE.PATIENT,
    ...patientName,
    email: settings.patientEmail,
    sendEmail: false,
    membership: { profile: createReference(patient) },
  });
  if (
    !isResource<WithId<ProjectMembership>>(
      invitation,
      RESOURCE_TYPE.PROJECT_MEMBERSHIP,
    )
  ) {
    throw new Error(
      "Medplum invited the example patient but did not return her project membership, so her password was not set. Load again to set it.",
    );
  }
  return invitation;
};

const createOrRestoreAccount = async (
  parameters: AccountParameters,
): Promise<string> => {
  const existingMembership = await findMembership(
    parameters.medplumClient,
    parameters.patient,
  );
  const membership = existingMembership ?? (await invitePatient(parameters));
  assertMembershipHasAccessPolicy(membership);
  const signInMessages = await restoreSignIn({ ...parameters, membership });
  return [
    existingMembership ? ACCOUNT_FOUND_MESSAGE : ACCOUNT_INVITED_MESSAGE,
    ...signInMessages,
    SIGN_IN_INSTRUCTION,
  ].join(" ");
};

export const loadExampleData = async ({
  bundle,
  day,
  medplumClient,
  report,
  settings,
}: LoadExampleDataParameters): Promise<void> => {
  const patientName = readPatientName(bundle);
  const movedBundle = moveDatesToDay(bundle, day);
  const project = await readPortalProject(
    medplumClient,
    settings.portalProjectIdentifier,
  );
  assertPatientsGetAccessPolicy(project);

  const response = await medplumClient.executeBatch(movedBundle);
  assertEveryEntrySucceeded(response);
  report(
    `Loaded ${response.entry?.length ?? 0} example resources into project ${project.name}.`,
  );

  report(
    await createOrRestoreAccount({
      medplumClient,
      patient: findPatient(response),
      patientName,
      project,
      settings,
    }),
  );
};
