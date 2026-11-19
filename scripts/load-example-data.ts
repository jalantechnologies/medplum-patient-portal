import { ClientStorage, MedplumClient, MemoryStorage } from "@medplum/core";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadEnv } from "vite";

import { indexFhirDefinitions, readExampleBundle } from "./example-data.ts";
import {
  DEVELOPMENT_MODE,
  loadExampleData,
  readSettings,
} from "./example-loader.ts";

const EVERY_VARIABLE_PREFIX = "";

const { values: options } = parseArgs({
  options: { mode: { type: "string", default: DEVELOPMENT_MODE } },
});
const settings = readSettings({
  environment: loadEnv(
    options.mode,
    join(import.meta.dirname, ".."),
    EVERY_VARIABLE_PREFIX,
  ),
  mode: options.mode,
});
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
