import { describe, expect, it } from "vitest";

import {
  parseUserCreateOptions,
  UserCreateArgumentError,
} from "../scripts/user-create-options";

describe("initial-user command options", () => {
  it.each(["--help", "-h"])("accepts the %s help option", (option) => {
    expect(parseUserCreateOptions([option])).toEqual({ help: true });
  });

  it.each(["local", "remote"] as const)(
    "selects the %s database explicitly",
    (mode) => {
      expect(
        parseUserCreateOptions([`--${mode}`, "--email", "owner@example.com"]),
      ).toEqual({
        help: false,
        mode,
        email: "owner@example.com",
      });
    },
  );

  it.each([
    {
      arguments_: ["--email", "owner@example.com"],
      message: "Choose a database with --local or --remote.",
    },
    {
      arguments_: ["--local"],
      message: "Provide the new user's email with --email.",
    },
    {
      arguments_: ["--local", "--remote", "--email", "owner@example.com"],
      message: "Choose either --local or --remote, not both.",
    },
    {
      arguments_: ["--local", "--email"],
      message: "--email requires a value.",
    },
    {
      arguments_: [
        "--local",
        "--email",
        "owner@example.com",
        "--password",
        "secret",
      ],
      message: "Unknown option: --password",
    },
  ])("rejects unsafe or incomplete arguments", ({ arguments_, message }) => {
    expect(() => parseUserCreateOptions(arguments_)).toThrow(
      new UserCreateArgumentError(message),
    );
  });
});
