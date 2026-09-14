export type UserCreateMode = "local" | "remote";

export type UserCreateOptions =
  | { help: true }
  | {
      help: false;
      mode: UserCreateMode;
      email: string;
    };

export class UserCreateArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserCreateArgumentError";
  }
}

export function parseUserCreateOptions(
  arguments_: readonly string[],
): UserCreateOptions {
  if (arguments_.includes("--help") || arguments_.includes("-h")) {
    return { help: true };
  }

  let email: string | undefined;
  let mode: UserCreateMode | undefined;

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];

    switch (argument) {
      case "--local":
      case "--remote": {
        const nextMode = argument.slice(2) as UserCreateMode;

        if (mode && mode !== nextMode) {
          throw new UserCreateArgumentError(
            "Choose either --local or --remote, not both.",
          );
        }

        mode = nextMode;
        break;
      }
      case "--email": {
        const value = arguments_[index + 1];

        if (!value || value.startsWith("--")) {
          throw new UserCreateArgumentError("--email requires a value.");
        }

        email = value;
        index += 1;
        break;
      }
      default:
        throw new UserCreateArgumentError(`Unknown option: ${argument ?? ""}`);
    }
  }

  if (!mode) {
    throw new UserCreateArgumentError(
      "Choose a database with --local or --remote.",
    );
  }

  if (!email) {
    throw new UserCreateArgumentError(
      "Provide the new user's email with --email.",
    );
  }

  return { help: false, mode, email };
}
