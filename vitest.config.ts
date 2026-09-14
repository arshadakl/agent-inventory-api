import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

process.env.WRANGLER_LOG_PATH = ".wrangler/logs/vitest.log";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const { unstable_splitSqlQuery } = await import("wrangler");
      const migrationsPath = fileURLToPath(
        new URL("./migrations", import.meta.url),
      );
      const migrationNames = (await readdir(migrationsPath))
        .filter((name) => name.endsWith(".sql"))
        .sort();
      const migrations = await Promise.all(
        migrationNames.map(async (name) => ({
          name,
          queries: unstable_splitSqlQuery(
            await readFile(
              new URL(`./migrations/${name}`, import.meta.url),
              "utf8",
            ),
          ),
        })),
      );

      return {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
});
