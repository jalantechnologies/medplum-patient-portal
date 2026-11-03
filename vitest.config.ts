import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      restoreMocks: true,
      setupFiles: ["./src/apps/frontend/vitest.setup.ts"],
      env: {
        VITE_MEDPLUM_SERVER_ADDRESS: "http://localhost:8103/",
        VITE_MEDPLUM_PROJECT_IDENTIFIER: "test-project",
      },
    },
  }),
);
