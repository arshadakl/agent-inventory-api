import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, URL } from "node:url";

import { input, password } from "@inquirer/prompts";

import {
  createUserSchema,
  normalizedEmailSchema,
} from "../shared/schemas/auth";
import type { Bindings } from "../worker/env";
import {
  createUser,
  EmailAlreadyExistsError,
} from "../worker/services/users.service";
import {
  parseUserCreateOptions,
  UserCreateArgumentError,
  type UserCreateMode,
} from "./user-create-options";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const wranglerConfigPath = path.join(projectRoot, "wrangler.jsonc");

process.env.WRANGLER_LOG_PATH = path.join(
  projectRoot,
  ".wrangler",
  "logs",
  "user-create.log",
);

const usage = `Create an initial application user.

Usage:
  npm run user:create -- --local --email owner@example.com
  npm run user:create -- --remote --email owner@example.com

Options:
  --local          Use the persistent local D1 database
  --remote         Use the configured remote D1 database
  --email <email>  Email address for the new user
  -h, --help       Show this help

The password is always collected through a masked prompt.`;

async function main(): Promise<void> {
  const options = parseUserCreateOptions(process.argv.slice(2));

  if (options.help) {
    console.log(usage);
    return;
  }

  const emailResult = normalizedEmailSchema.safeParse(options.email);

  if (!emailResult.success) {
    throw new UserCreateArgumentError(
      emailResult.error.issues[0]?.message ?? "Invalid email.",
    );
  }

  if (options.mode === "remote") {
    await confirmRemoteCreation(emailResult.data);
  }

  const enteredPassword = await password({
    message: "Password",
    mask: "*",
  });
  const confirmedPassword = await password({
    message: "Confirm password",
    mask: "*",
  });

  if (enteredPassword !== confirmedPassword) {
    throw new UserCreateArgumentError("Passwords do not match.");
  }

  const inputResult = createUserSchema.safeParse({
    email: emailResult.data,
    password: enteredPassword,
  });

  if (!inputResult.success) {
    throw new UserCreateArgumentError(
      inputResult.error.issues[0]?.message ?? "Invalid user details.",
    );
  }

  const connection = await connectToDatabase(options.mode);

  try {
    const user = await createUser(connection.database, inputResult.data);
    console.log(`Created ${options.mode} user ${user.email} (${user.id}).`);
  } finally {
    await connection.dispose();
  }
}

async function confirmRemoteCreation(email: string): Promise<void> {
  console.warn("Warning: remote mode writes to the production D1 database.");
  const confirmation = await input({
    message: `Type ${email} to confirm`,
  });

  if (confirmation.trim().toLowerCase() !== email) {
    throw new UserCreateArgumentError(
      "Remote user creation was not confirmed.",
    );
  }
}

interface DatabaseConnection {
  database: D1Database;
  dispose(): Promise<void>;
}

async function connectToDatabase(
  mode: UserCreateMode,
): Promise<DatabaseConnection> {
  const { getPlatformProxy } = await import("wrangler");
  let temporaryDirectory: string | undefined;
  let configPath = wranglerConfigPath;

  if (mode === "remote") {
    const remoteConfiguration = await createRemoteConfiguration();
    temporaryDirectory = remoteConfiguration.directory;
    configPath = remoteConfiguration.path;
  }

  try {
    const platform = await getPlatformProxy<Bindings>({
      configPath,
      persist: mode === "local",
      remoteBindings: mode === "remote",
    });

    return {
      database: platform.env.DB,
      async dispose() {
        await platform.dispose();

        if (temporaryDirectory) {
          await rm(temporaryDirectory, { recursive: true, force: true });
        }
      },
    };
  } catch (error) {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }

    throw error;
  }
}

interface RemoteConfiguration {
  directory: string;
  path: string;
}

interface D1Configuration {
  binding: string;
  database_id?: string;
  database_name?: string;
}

async function createRemoteConfiguration(): Promise<RemoteConfiguration> {
  const { unstable_readConfig } = await import("wrangler");
  const sourceConfig = unstable_readConfig(
    { config: wranglerConfigPath },
    { hideWarnings: true },
  );
  const databases = sourceConfig.d1_databases as D1Configuration[];
  const database = databases.find(({ binding }) => binding === "DB");

  if (!database?.database_id || /^0+(-0+)+$/u.test(database.database_id)) {
    throw new UserCreateArgumentError(
      "Replace the placeholder D1 database_id in wrangler.jsonc before using --remote.",
    );
  }

  const directory = await mkdtemp(
    path.join(tmpdir(), "real-estate-inventory-provisioner-"),
  );
  const configPath = path.join(directory, "wrangler.json");
  const remoteConfig = {
    name: `${sourceConfig.name}-user-provisioner`,
    compatibility_date: sourceConfig.compatibility_date,
    d1_databases: [
      {
        binding: "DB",
        database_name: database.database_name,
        database_id: database.database_id,
        remote: true,
      },
    ],
  };

  await writeFile(configPath, JSON.stringify(remoteConfig), {
    encoding: "utf8",
    mode: 0o600,
  });

  return { directory, path: configPath };
}

try {
  await main();
} catch (error) {
  if (
    error instanceof UserCreateArgumentError ||
    error instanceof EmailAlreadyExistsError
  ) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error(
      "User creation failed. Check the local Wrangler log for diagnostic details.",
    );
  }

  process.exitCode = 1;
}
