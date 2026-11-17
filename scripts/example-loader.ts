import {
  createReference,
  escapeSearchValue,
  formatSearchQuery,
  getReferenceString,
  type MedplumClient,
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

interface AccountParameters {
  medplumClient: MedplumClient;
  patient: WithId<Patient>;
  patientName: PatientName;
  project: WithId<Project>;
  settings: ExampleSettings;
}

const VARIABLE_NAME = {
  CLIENT_IDENTIFIER: "MEDPLUM_CLIENT_IDENTIFIER",
  CLIENT_SECRET: "MEDPLUM_CLIENT_SECRET",
  PATIENT_EMAIL: "EXAMPLE_PATIENT_EMAIL",
  PATIENT_PASSWORD: "EXAMPLE_PATIENT_PASSWORD",
  PROJECT_IDENTIFIER: "VITE_MEDPLUM_PROJECT_IDENTIFIER",
  SERVER_ADDRESS: "VITE_MEDPLUM_SERVER_ADDRESS",
} as const;

const readRequiredVariable = (
  environment: Record<string, string | undefined>,
  name: string,
): string => {
  const value = environment[name];
  if (!value) {
    throw new Error(
      `Set ${name} in .env.local, as the README's "Example data" section describes.`,
    );
  }
  return value;
};

export const readSettings = (
  environment: Record<string, string | undefined>,
): ExampleSettings => ({
  clientIdentifier: readRequiredVariable(
    environment,
    VARIABLE_NAME.CLIENT_IDENTIFIER,
  ),
  clientSecret: readRequiredVariable(environment, VARIABLE_NAME.CLIENT_SECRET),
  patientEmail: readRequiredVariable(environment, VARIABLE_NAME.PATIENT_EMAIL),
  patientPassword: readRequiredVariable(
    environment,
    VARIABLE_NAME.PATIENT_PASSWORD,
  ),
  portalProjectIdentifier: readRequiredVariable(
    environment,
    VARIABLE_NAME.PROJECT_IDENTIFIER,
  ),
  serverAddress: readRequiredVariable(
    environment,
    VARIABLE_NAME.SERVER_ADDRESS,
  ),
});

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

const keepAccount = (membership: ProjectMembership): string => {
  if (!hasAccessPolicy(membership)) {
    throw new Error(
      `The example patient's records loaded, but her account has no access policy, so she can read every record in the project. Give her project membership the portal's policy, as the README's "Patient access" section describes, then load again.`,
    );
  }
  return "The example patient already has an account, which was left as it is.";
};

const inviteToAccount = async ({
  medplumClient,
  patient,
  patientName,
  project,
  settings,
}: AccountParameters): Promise<string> => {
  const existingUser = await findProjectUser(
    medplumClient,
    project,
    settings.patientEmail,
  );
  await medplumClient.invite(project.id, {
    resourceType: RESOURCE_TYPE.PATIENT,
    ...patientName,
    email: settings.patientEmail,
    password: settings.patientPassword,
    sendEmail: false,
    membership: { profile: createReference(patient) },
  });
  if (existingUser) {
    return `Invited the example patient with the user that already has ${VARIABLE_NAME.PATIENT_EMAIL} in project ${project.name}. Medplum keeps that user's password, so sign in with it, not with ${VARIABLE_NAME.PATIENT_PASSWORD}.`;
  }
  return `Invited the example patient. Sign in to the portal with ${VARIABLE_NAME.PATIENT_EMAIL} and ${VARIABLE_NAME.PATIENT_PASSWORD}.`;
};

const createOrKeepAccount = async (
  parameters: AccountParameters,
): Promise<string> => {
  const membership = await findMembership(
    parameters.medplumClient,
    parameters.patient,
  );
  return membership ? keepAccount(membership) : inviteToAccount(parameters);
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
    await createOrKeepAccount({
      medplumClient,
      patient: findPatient(response),
      patientName,
      project,
      settings,
    }),
  );
};
