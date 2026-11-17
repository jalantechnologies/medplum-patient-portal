import {
  badRequest,
  createReference,
  getStatus,
  OperationOutcomeError,
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
import { MockClient } from "@medplum/mock";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BUNDLE_TYPE,
  RESOURCE_TYPE,
} from "../src/apps/frontend/constants/fhir.ts";
import {
  findPatient,
  indexFhirDefinitions,
  readExampleBundle,
} from "./example-data.ts";
import {
  type ExampleSettings,
  loadExampleData,
  readSettings,
} from "./example-loader.ts";

const LOAD_DAY = Temporal.PlainDate.from("2026-11-17");
const PATIENT_POLICY: Reference<AccessPolicy> = {
  reference: "AccessPolicy/portal-patient-policy",
};
const ENVIRONMENT = {
  MEDPLUM_CLIENT_IDENTIFIER: "example-client",
  MEDPLUM_CLIENT_SECRET: "example-secret",
  EXAMPLE_PATIENT_EMAIL: "Eleanor.Walsh@example.com",
  EXAMPLE_PATIENT_PASSWORD: "example-password",
  VITE_MEDPLUM_PROJECT_IDENTIFIER: "example-project",
  VITE_MEDPLUM_SERVER_ADDRESS: "http://localhost:8103/",
};
const REQUEST_FAILURE = new OperationOutcomeError(
  badRequest("Example failure"),
);

let exampleBundle: Bundle;
let medplumClient: MockClient;
let project: WithId<Project>;
let settings: ExampleSettings;
let messages: string[];

const updateProject = async (changes: Partial<Project>): Promise<void> => {
  project = await medplumClient.updateResource({ ...project, ...changes });
};

const fakeInvite = () =>
  vi
    .spyOn(medplumClient, "invite")
    .mockImplementation(async (_projectIdentifier, request) =>
      medplumClient.createResource<ProjectMembership>({
        resourceType: RESOURCE_TYPE.PROJECT_MEMBERSHIP,
        project: createReference(project),
        user: { reference: "User/example-user" },
        profile: request.membership?.profile as Reference<Patient>,
        accessPolicy: PATIENT_POLICY,
      }),
    );

const load = (bundle = exampleBundle): Promise<void> =>
  loadExampleData({
    bundle,
    day: LOAD_DAY,
    medplumClient,
    report: (message) => messages.push(message),
    settings,
  });

const loadAndChangeAccount = async (
  changes: Partial<ProjectMembership>,
): Promise<ReturnType<typeof fakeInvite>> => {
  const invite = fakeInvite();
  await load();
  const membership = (await invite.mock.results[0]
    .value) as WithId<ProjectMembership>;
  await medplumClient.updateResource({ ...membership, ...changes });
  messages = [];
  return invite;
};

beforeAll(async () => {
  indexFhirDefinitions();
  exampleBundle = await readExampleBundle();
});

beforeEach(async () => {
  medplumClient = new MockClient();
  const projectIdentifier = medplumClient.getProject()?.id ?? "";
  project = await medplumClient.readResource(
    RESOURCE_TYPE.PROJECT,
    projectIdentifier,
  );
  settings = readSettings({
    ...ENVIRONMENT,
    VITE_MEDPLUM_PROJECT_IDENTIFIER: projectIdentifier,
  });
  messages = [];
  await updateProject({
    defaultAccessPolicies: [
      {
        profileType: RESOURCE_TYPE.PATIENT,
        accessPolicy: PATIENT_POLICY,
      },
    ],
  });
});

describe("readSettings", () => {
  it("reads every variable the loader needs", () => {
    expect(readSettings(ENVIRONMENT)).toEqual({
      clientIdentifier: "example-client",
      clientSecret: "example-secret",
      patientEmail: "Eleanor.Walsh@example.com",
      patientPassword: "example-password",
      portalProjectIdentifier: "example-project",
      serverAddress: "http://localhost:8103/",
    });
  });

  it.each([undefined, ""])(
    "names a variable that is %j, as one copied from .env.example is",
    (value) => {
      expect(() =>
        readSettings({ ...ENVIRONMENT, EXAMPLE_PATIENT_PASSWORD: value }),
      ).toThrow(
        'Set EXAMPLE_PATIENT_PASSWORD in .env.local, as the README\'s "Example data" section describes.',
      );
    },
  );
});

describe("loadExampleData", () => {
  it("loads the records moved to the load day and invites the example patient to her own record", async () => {
    const executeBatch = vi.spyOn(medplumClient, "executeBatch");
    const invite = fakeInvite();

    await load();

    const [[sentBundle]] = executeBatch.mock.calls;
    const patient = findPatient(await executeBatch.mock.results[0].value);
    expect(sentBundle.timestamp).toBe("2026-11-17T00:00:00-06:00");
    expect(invite).toHaveBeenCalledWith(project.id, {
      resourceType: RESOURCE_TYPE.PATIENT,
      firstName: "Eleanor",
      lastName: "Walsh",
      email: "Eleanor.Walsh@example.com",
      password: "example-password",
      sendEmail: false,
      membership: { profile: createReference(patient) },
    });
    expect(messages).toEqual([
      `Loaded ${exampleBundle.entry?.length} example resources into project ${project.name}.`,
      "Invited the example patient. Sign in to the portal with EXAMPLE_PATIENT_EMAIL and EXAMPLE_PATIENT_PASSWORD.",
    ]);
  });

  it("keeps the account on a second load", async () => {
    const invite = fakeInvite();

    await load();
    await load();

    expect(invite).toHaveBeenCalledTimes(1);
    expect(messages.at(-1)).toBe(
      "The example patient already has an account, which was left as it is.",
    );
  });

  it("refuses a client application from another project before loading anything", async () => {
    const executeBatch = vi.spyOn(medplumClient, "executeBatch");
    settings = { ...settings, portalProjectIdentifier: "another-project" };

    await expect(load()).rejects.toThrow(
      `The client application belongs to project ${project.id}, not to the portal's project another-project in VITE_MEDPLUM_PROJECT_IDENTIFIER.`,
    );
    expect(executeBatch).not.toHaveBeenCalled();
  });

  it("refuses a project that gives invited patients no access policy, before loading anything", async () => {
    const executeBatch = vi.spyOn(medplumClient, "executeBatch");
    await updateProject({ defaultAccessPolicies: undefined });

    await expect(load()).rejects.toThrow(
      `Project ${project.name} gives invited patients no access policy`,
    );
    expect(executeBatch).not.toHaveBeenCalled();
  });

  it("accepts a project that names the policy only in the older defaultPatientAccessPolicy, which Medplum's invite falls back to", async () => {
    const invite = fakeInvite();
    await updateProject({
      defaultAccessPolicies: undefined,
      defaultPatientAccessPolicy: PATIENT_POLICY,
    });

    await load();

    expect(invite).toHaveBeenCalledTimes(1);
  });

  it("refuses a patient with no name before loading anything", async () => {
    const executeBatch = vi.spyOn(medplumClient, "executeBatch");
    const bundle: Bundle = {
      ...exampleBundle,
      entry: exampleBundle.entry?.map((entry) =>
        entry.resource?.resourceType === RESOURCE_TYPE.PATIENT
          ? { ...entry, resource: { ...entry.resource, name: undefined } }
          : entry,
      ),
    };

    await expect(load(bundle)).rejects.toThrow(
      "The example patient needs a given and a family name",
    );
    expect(executeBatch).not.toHaveBeenCalled();
  });

  it("stops before the account step when Medplum refuses a record", async () => {
    const invite = fakeInvite();
    vi.spyOn(medplumClient, "executeBatch").mockResolvedValue({
      resourceType: RESOURCE_TYPE.BUNDLE,
      type: BUNDLE_TYPE.TRANSACTION_RESPONSE,
      entry: [
        {
          response: {
            status: String(getStatus(REQUEST_FAILURE.outcome)),
            outcome: REQUEST_FAILURE.outcome,
          },
        },
      ],
    });

    await expect(load()).rejects.toThrow(
      "Medplum refused part of the example data: Example failure",
    );
    expect(invite).not.toHaveBeenCalled();
  });

  it("refuses an account that has no access policy, since it could read every record", async () => {
    const invite = await loadAndChangeAccount({ accessPolicy: undefined });

    await expect(load()).rejects.toThrow(
      "The example patient's records loaded, but her account has no access policy",
    );
    expect(invite).toHaveBeenCalledTimes(1);
  });

  it("keeps an account whose access comes from Access entries", async () => {
    const invite = await loadAndChangeAccount({
      accessPolicy: undefined,
      access: [{ policy: PATIENT_POLICY }],
    });

    await load();

    expect(invite).toHaveBeenCalledTimes(1);
    expect(messages.at(-1)).toBe(
      "The example patient already has an account, which was left as it is.",
    );
  });

  it("says the password stays when a user with the patient's email is already in the project", async () => {
    fakeInvite();
    const searchOne = vi.spyOn(medplumClient, "searchOne");
    await medplumClient.createResource<User>({
      resourceType: RESOURCE_TYPE.USER,
      firstName: "Eleanor",
      lastName: "Walsh",
      email: "eleanor.walsh@example.com",
      project: createReference(project),
    });

    await load();

    expect(searchOne).toHaveBeenCalledWith(
      RESOURCE_TYPE.USER,
      expect.stringContaining(encodeURIComponent("eleanor.walsh@example.com")),
    );
    expect(messages.at(-1)).toBe(
      `Invited the example patient with the user that already has EXAMPLE_PATIENT_EMAIL in project ${project.name}. Medplum keeps that user's password, so sign in with it, not with EXAMPLE_PATIENT_PASSWORD.`,
    );
  });

  it.each([
    [
      "reading the project",
      () =>
        vi
          .spyOn(medplumClient, "readResource")
          .mockRejectedValueOnce(REQUEST_FAILURE),
    ],
    [
      "loading the records",
      () =>
        vi
          .spyOn(medplumClient, "executeBatch")
          .mockRejectedValueOnce(REQUEST_FAILURE),
    ],
    [
      "looking for her account",
      () =>
        vi
          .spyOn(medplumClient, "searchOne")
          .mockRejectedValueOnce(REQUEST_FAILURE),
    ],
    [
      "looking for a user with her email",
      () => {
        const searchOne = medplumClient.searchOne.bind(medplumClient);
        vi.spyOn(medplumClient, "searchOne")
          .mockImplementationOnce(searchOne)
          .mockRejectedValueOnce(REQUEST_FAILURE);
      },
    ],
    [
      "inviting her",
      () =>
        vi
          .spyOn(medplumClient, "invite")
          .mockRejectedValueOnce(REQUEST_FAILURE),
    ],
  ])("reports a failure while %s", async (_step, failRequest) => {
    fakeInvite();
    failRequest();

    await expect(load()).rejects.toBe(REQUEST_FAILURE);
  });
});
