import { z } from "zod";

const treatBlankAsUnset = (value: unknown) =>
  value === "" ? undefined : value;

const configurationSchema = z.object({
  VITE_MEDPLUM_SERVER_ADDRESS: z.url(),
  VITE_MEDPLUM_PROJECT_IDENTIFIER: z.string().min(1),
  VITE_SIGN_UP_ENABLED: z.preprocess(
    treatBlankAsUnset,
    z.stringbool().optional(),
  ),
});

export const readConfiguration = (environment: unknown) => {
  const parsedEnvironment = configurationSchema.safeParse(environment);
  if (!parsedEnvironment.success) {
    throw new Error(
      `The configuration is incomplete. Copy .env.example to .env.local and fill it in.\n${z.prettifyError(parsedEnvironment.error)}`,
    );
  }
  return {
    medplumServerAddress: parsedEnvironment.data.VITE_MEDPLUM_SERVER_ADDRESS,
    medplumProjectIdentifier:
      parsedEnvironment.data.VITE_MEDPLUM_PROJECT_IDENTIFIER,
    isSignUpEnabled: parsedEnvironment.data.VITE_SIGN_UP_ENABLED ?? false,
  };
};

export const configuration = readConfiguration(import.meta.env);
