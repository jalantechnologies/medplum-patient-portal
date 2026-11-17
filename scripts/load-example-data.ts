import { ClientStorage, MedplumClient, MemoryStorage } from "@medplum/core";
import { join } from "node:path";
import { loadEnv } from "vite";

import { indexFhirDefinitions, readExampleBundle } from "./example-data.ts";
import { loadExampleData, readSettings } from "./example-loader.ts";

const DEVELOPMENT_MODE = "development";
const EVERY_VARIABLE_PREFIX = "";

const settings = readSettings(
  loadEnv(
    DEVELOPMENT_MODE,
    join(import.meta.dirname, ".."),
    EVERY_VARIABLE_PREFIX,
  ),
);
const medplumClient = new MedplumClient({
  baseUrl: settings.serverAddress,
  storage: new ClientStorage(new MemoryStorage()),
});
await medplumClient.startClientLogin(
  settings.clientIdentifier,
  settings.clientSecret,
);

indexFhirDefinitions();
await loadExampleData({
  bundle: await readExampleBundle(),
  day: Temporal.Now.plainDateISO(),
  medplumClient,
  report: console.log,
  settings,
});
