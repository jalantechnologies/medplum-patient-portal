import {
  badRequest,
  createReference,
  escapeSearchValue,
  formatSearchQuery,
  getReferenceString,
  getStatus,
  OperationOutcomeError,
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
import { MockClient } from "@medplum/mock";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import {
  BUNDLE_TYPE,
  RESOURCE_TYPE,
  SEARCH_PARAMETER,
  USER_MULTI_FACTOR_AUTHENTICATION_METHOD,
} from "../src/apps/frontend/constants/fhir.ts";
import {
  findPatient,
  indexFhirDefinitions,
  readExampleBundle,
} from "./example-data.ts";
import {
  DEVELOPMENT_MODE,
  type ExampleSettings,
  loadExampleData,
  readSettings,
} from "./example-loader.ts";

interface PostFailure {
  path: string;
  occurrence?: number;
  failure?: OperationOutcomeError;
}

const DEMO_MODE = "demo";
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
const PATIENT_SIGN_IN = {
  email: "Eleanor.Walsh@example.com",
  password: "example-password",
};
const REQUEST_FAILURE = new OperationOutcomeError(
  badRequest("Example failure"),
);
const BREACHED_PASSWORD_FAILURE = new OperationOutcomeError(
  badRequest("Password found in breach database"),
);
const ADMINISTRATION_PATH_PREFIX = "admin/";
const SET_PASSWORD_PATH = "admin/projects/setpassword";
const SIGN_IN_INSTRUCTION =
  "Sign in to the portal with EXAMPLE_PATIENT_EMAIL and EXAMPLE_PATIENT_PASSWORD.";
const PASSWORD_SET_MESSAGE = "Set her password to EXAMPLE_PATIENT_PASSWORD.";
const MULTI_FACTOR_AUTHENTICATION_RESET_MESSAGE =
  "Turned off the multi-factor authentication on her account.";
const INVITED_MESSAGE = `Invited the example patient. ${PASSWORD_SET_MESSAGE} ${SIGN_IN_INSTRUCTION}`;
const RESTORED_MESSAGE = `The example patient already has an account. ${PASSWORD_SET_MESSAGE} ${SIGN_IN_INSTRUCTION}`;

let exampleBundle: Bundle;
let medplumClient: MockClient;
let project: WithId<Project>;
let settings: ExampleSettings;
let messages: string[];

const updateProject = async (changes: Partial<Project>): Promise<void> => {
  project = await medplumClient.updateResource({ ...project, ...changes });
};

const createProjectUser = (email: string): Promise<WithId<User>> =>
  medplumClient.createResource<User>({
    resourceType: RESOURCE_TYPE.USER,
    firstName: "Eleanor",
    lastName: "Walsh",
    email: email.toLowerCase(),
    project: createReference(project),
  });

const findOrCreateProjectUser = async (
  email: string,
): Promise<WithId<User>> => {
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
  const [existingUser] = await medplumClient.searchResources(
    searchRequest.resourceType,
    formatSearchQuery(searchRequest),
  );
  return existingUser ?? createProjectUser(email);
};

const fakeInvite = () =>
  vi
    .spyOn(medplumClient, "invite")
    .mockImplementation(async (_projectIdentifier, request) =>
      medplumClient.createResource<ProjectMembership>({
        resourceType: RESOURCE_TYPE.PROJECT_MEMBERSHIP,
        project: createReference(project),
        user: createReference(
          await findOrCreateProjectUser(request.email ?? ""),
        ),
        profile: request.membership?.profile as Reference<Patient>,
        accessPolicy: PATIENT_POLICY,
      }),
    );

const failSearch = (occurrence: number): void => {
  const searchOne = medplumClient.searchOne.bind(medplumClient);
  const search = vi.spyOn(medplumClient, "searchOne");
  for (let index = 1; index < occurrence; index += 1) {
    search.mockImplementationOnce(searchOne);
  }
  search.mockRejectedValueOnce(REQUEST_FAILURE);
};

const failPost = ({
  path,
  occurrence = 1,
  failure = REQUEST_FAILURE,
}: PostFailure): void => {
  const post = medplumClient.post.bind(medplumClient);
  let calls = 0;
  vi.spyOn(medplumClient, "post").mockImplementation((url, ...rest) => {
    if (url.toString() === path) {
      calls += 1;
      if (calls === occurrence) {
        return Promise.reject(failure);
      }
    }
    return post(url, ...rest);
  });
};

const listAdministrationRequests = (
  post: MockInstance<MockClient["post"]>,
): unknown[][] =>
  post.mock.calls
    .filter(([url]) => url.toString().startsWith(ADMINISTRATION_PATH_PREFIX))
    .map(([url, body]) => [url, body]);

const buildMultiFactorAuthenticationResetPath = (
  membership: WithId<ProjectMembership>,
): string => `admin/projects/${project.id}/members/${membership.id}/mfa/reset`;

const enrollInMultiFactorAuthentication = async (
  membership: ProjectMembership,
  changes: Partial<User>,
): Promise<void> => {
  const user = await medplumClient.readReference(
    membership.user as Reference<User>,
  );
  await medplumClient.updateResource({ ...user, ...changes });
};

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

const loadAccount = async (): Promise<WithId<ProjectMembership>> => {
  const invite = fakeInvite();
  await load();
  messages = [];
  return (await invite.mock.results[0].value) as WithId<ProjectMembership>;
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
    environment: {
      ...ENVIRONMENT,
      VITE_MEDPLUM_PROJECT_IDENTIFIER: projectIdentifier,
    },
    mode: DEVELOPMENT_MODE,
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
    expect(
      readSettings({ environment: ENVIRONMENT, mode: DEVELOPMENT_MODE }),
    ).toEqual({
      clientIdentifier: "example-client",
      clientSecret: "example-secret",
      patientEmail: "Eleanor.Walsh@example.com",
      patientPassword: "example-password",
      portalProjectIdentifier: "example-project",
      serverAddress: "http://localhost:8103/",
    });
  });

  it.each([undefined, ""])(
    "names a variable that is %j, as one copied from .env.example is, and .env.local to set it in",
    (value) => {
      expect(() =>
        readSettings({
          environment: { ...ENVIRONMENT, EXAMPLE_PATIENT_PASSWORD: value },
          mode: DEVELOPMENT_MODE,
        }),
      ).toThrow(
        'Set EXAMPLE_PATIENT_PASSWORD in .env.local. The README\'s "Example data" section says what it holds.',
      );
    },
  );

  it("names the mode's own file for a variable missing in another mode, so a demo value stays out of .env.local", () => {
    expect(() =>
      readSettings({
        environment: { ...ENVIRONMENT, MEDPLUM_CLIENT_SECRET: undefined },
        mode: DEMO_MODE,
      }),
    ).toThrow(
      'Set MEDPLUM_CLIENT_SECRET in .env.demo.local. The README\'s "Example data" section says what it holds.',
    );
  });
});

describe("loadExampleData", () => {
  it("loads the records moved to the load day, invites the example patient to her own record and sets her password", async () => {
    const executeBatch = vi.spyOn(medplumClient, "executeBatch");
    const invite = fakeInvite();
    const post = vi.spyOn(medplumClient, "post");

    await load();

    const [[sentBundle]] = executeBatch.mock.calls;
    const patient = findPatient(await executeBatch.mock.results[0].value);
    expect(sentBundle.timestamp).toBe("2026-11-17T00:00:00-06:00");
    expect(invite).toHaveBeenCalledWith(project.id, {
      resourceType: RESOURCE_TYPE.PATIENT,
      firstName: "Eleanor",
      lastName: "Walsh",
      email: "Eleanor.Walsh@example.com",
      sendEmail: false,
      membership: { profile: createReference(patient) },
    });
    expect(listAdministrationRequests(post)).toEqual([
      [SET_PASSWORD_PATH, PATIENT_SIGN_IN],
    ]);
    expect(messages).toEqual([
      `Loaded ${exampleBundle.entry?.length} example resources into project ${project.name}.`,
      INVITED_MESSAGE,
    ]);
  });

  it("keeps the account on a second load, and sets its password again", async () => {
    const invite = fakeInvite();
    await load();
    const post = vi.spyOn(medplumClient, "post");

    await load();

    expect(invite).toHaveBeenCalledTimes(1);
    expect(listAdministrationRequests(post)).toEqual([
      [SET_PASSWORD_PATH, PATIENT_SIGN_IN],
    ]);
    expect(messages.at(-1)).toBe(RESTORED_MESSAGE);
  });

  it.each([
    [
      "whose user is not the project's user with her email",
      async () => {
        await loadAndChangeAccount({
          user: { reference: "User/another-user" },
        });
      },
    ],
    [
      "after EXAMPLE_PATIENT_EMAIL changed",
      async () => {
        await loadAccount();
        settings = { ...settings, patientEmail: "Eleanor.Walsh2@example.com" };
      },
    ],
  ])(
    "stops before changing the sign-in of an account %s",
    async (_case, changeAccount) => {
      await changeAccount();
      const post = vi.spyOn(medplumClient, "post");

      await expect(load()).rejects.toThrow(
        `The example patient's account does not belong to the user with EXAMPLE_PATIENT_EMAIL in project ${project.name}, so her sign-in was left as it is.`,
      );
      expect(listAdministrationRequests(post)).toEqual([]);
    },
  );

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

  it("refuses an account that has no access policy, since it could read every record, before changing its sign-in", async () => {
    const invite = await loadAndChangeAccount({ accessPolicy: undefined });
    const post = vi.spyOn(medplumClient, "post");

    await expect(load()).rejects.toThrow(
      "The example patient's records loaded, but her account has no access policy",
    );
    expect(invite).toHaveBeenCalledTimes(1);
    expect(listAdministrationRequests(post)).toEqual([]);
  });

  it("keeps an account whose access comes from Access entries", async () => {
    const invite = await loadAndChangeAccount({
      accessPolicy: undefined,
      access: [{ policy: PATIENT_POLICY }],
    });

    await load();

    expect(invite).toHaveBeenCalledTimes(1);
    expect(messages.at(-1)).toBe(RESTORED_MESSAGE);
  });

  it("sets the password of the user with the patient's email who is already in the project, which Medplum's invite reuses", async () => {
    fakeInvite();
    const searchOne = vi.spyOn(medplumClient, "searchOne");
    const post = vi.spyOn(medplumClient, "post");
    await createProjectUser("Eleanor.Walsh@example.com");

    await load();

    expect(searchOne).toHaveBeenCalledWith(
      RESOURCE_TYPE.USER,
      expect.stringContaining(encodeURIComponent("eleanor.walsh@example.com")),
    );
    expect(listAdministrationRequests(post)).toEqual([
      [SET_PASSWORD_PATH, PATIENT_SIGN_IN],
    ]);
    expect(messages.at(-1)).toBe(INVITED_MESSAGE);
  });

  it("turns off multi-factor authentication a visitor turned on before setting the password, so a refused password still leaves it off", async () => {
    const membership = await loadAccount();
    await enrollInMultiFactorAuthentication(membership, {
      mfaEnrolled: true,
      mfaMethod: [USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP],
    });
    const post = vi.spyOn(medplumClient, "post");

    await load();

    expect(listAdministrationRequests(post)).toEqual([
      [
        buildMultiFactorAuthenticationResetPath(membership),
        { method: USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP },
      ],
      [SET_PASSWORD_PATH, PATIENT_SIGN_IN],
    ]);
    expect(messages.at(-1)).toBe(
      `The example patient already has an account. ${MULTI_FACTOR_AUTHENTICATION_RESET_MESSAGE} ${PASSWORD_SET_MESSAGE} ${SIGN_IN_INSTRUCTION}`,
    );
  });

  it("turns off each method of multi-factor authentication, one after the other", async () => {
    const membership = await loadAccount();
    await enrollInMultiFactorAuthentication(membership, {
      mfaEnrolled: true,
      mfaMethod: [
        USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP,
        USER_MULTI_FACTOR_AUTHENTICATION_METHOD.EMAIL,
      ],
    });
    const post = vi.spyOn(medplumClient, "post");

    await load();

    expect(listAdministrationRequests(post)).toEqual([
      [
        buildMultiFactorAuthenticationResetPath(membership),
        { method: USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP },
      ],
      [
        buildMultiFactorAuthenticationResetPath(membership),
        { method: USER_MULTI_FACTOR_AUTHENTICATION_METHOD.EMAIL },
      ],
      [SET_PASSWORD_PATH, PATIENT_SIGN_IN],
    ]);
  });

  it("turns off an authenticator enrolled before Medplum listed methods", async () => {
    const membership = await loadAccount();
    await enrollInMultiFactorAuthentication(membership, { mfaEnrolled: true });
    const post = vi.spyOn(medplumClient, "post");

    await load();

    expect(post).toHaveBeenCalledWith(
      buildMultiFactorAuthenticationResetPath(membership),
      { method: USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP },
    );
  });

  it("turns off multi-factor authentication on the user with the patient's email who is already in the project", async () => {
    const invite = fakeInvite();
    const user = await createProjectUser("Eleanor.Walsh@example.com");
    await medplumClient.updateResource({
      ...user,
      mfaEnrolled: true,
      mfaMethod: [USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP],
    });
    const post = vi.spyOn(medplumClient, "post");

    await load();

    const membership = (await invite.mock.results[0]
      .value) as WithId<ProjectMembership>;
    expect(listAdministrationRequests(post)).toEqual([
      [
        buildMultiFactorAuthenticationResetPath(membership),
        { method: USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP },
      ],
      [SET_PASSWORD_PATH, PATIENT_SIGN_IN],
    ]);
    expect(messages.at(-1)).toBe(
      `Invited the example patient. ${MULTI_FACTOR_AUTHENTICATION_RESET_MESSAGE} ${PASSWORD_SET_MESSAGE} ${SIGN_IN_INSTRUCTION}`,
    );
  });

  it("stops before setting a password when Medplum returns no membership for the invitation", async () => {
    vi.spyOn(medplumClient, "invite").mockResolvedValueOnce(
      badRequest("Example failure"),
    );
    const post = vi.spyOn(medplumClient, "post");

    await expect(load()).rejects.toThrow(
      "Medplum invited the example patient but did not return her project membership, so her password was not set. Load again to set it.",
    );
    expect(listAdministrationRequests(post)).toEqual([]);
  });

  it("stops the first load when Medplum refuses the password, as it refuses one found in a breach database, and names the variable to change", async () => {
    fakeInvite();
    failPost({
      path: SET_PASSWORD_PATH,
      failure: BREACHED_PASSWORD_FAILURE,
    });

    await expect(load()).rejects.toMatchObject({
      message:
        "Medplum did not set the example patient's password to EXAMPLE_PATIENT_PASSWORD, and answered: Password found in breach database. If it found the password in a breach database, choose another one, then load again.",
      cause: BREACHED_PASSWORD_FAILURE,
    });
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
    ["looking for her account", () => failSearch(1)],
    [
      "inviting her",
      () =>
        vi
          .spyOn(medplumClient, "invite")
          .mockRejectedValueOnce(REQUEST_FAILURE),
    ],
    ["looking for her user", () => failSearch(2)],
    ["setting her password", () => failPost({ path: SET_PASSWORD_PATH })],
  ])(
    "reports a failure while %s on the first load",
    async (_step, failRequest) => {
      fakeInvite();
      failRequest();

      await expect(load()).rejects.toThrow(REQUEST_FAILURE.message);
    },
  );

  it.each<[string, (membership: WithId<ProjectMembership>) => void]>([
    ["looking for her user", () => failSearch(2)],
    [
      "turning off her first method of multi-factor authentication",
      (membership) =>
        failPost({ path: buildMultiFactorAuthenticationResetPath(membership) }),
    ],
    [
      "turning off her second method of multi-factor authentication",
      (membership) =>
        failPost({
          path: buildMultiFactorAuthenticationResetPath(membership),
          occurrence: 2,
        }),
    ],
    ["setting her password", () => failPost({ path: SET_PASSWORD_PATH })],
  ])("reports a failure while %s on a reload", async (_step, failRequest) => {
    const membership = await loadAccount();
    await enrollInMultiFactorAuthentication(membership, {
      mfaEnrolled: true,
      mfaMethod: [
        USER_MULTI_FACTOR_AUTHENTICATION_METHOD.TOTP,
        USER_MULTI_FACTOR_AUTHENTICATION_METHOD.EMAIL,
      ],
    });
    failRequest(membership);

    await expect(load()).rejects.toThrow(REQUEST_FAILURE.message);
  });
});
