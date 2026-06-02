import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["{src,server,shared}/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts", "node_modules/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: [
            "{src,server,shared,tests}/**/*.integration.test.ts",
          ],
          exclude: ["node_modules/**"],
          setupFiles: ["tests/setup.integration.ts"],
          fileParallelism: false,
        },
      },
    ],
  },
});
