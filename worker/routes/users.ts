import { z } from "zod";

import { createUserSchema } from "@shared/schemas/auth";
import type { ApiData } from "@shared/types/api";
import type { User } from "@shared/types/user";
import { Hono } from "hono";

import type { WorkerEnvironment } from "../env";
import { readJsonBody } from "../lib/request";
import { errorResponse, getZodFieldErrors } from "../lib/response";
import { getCurrentUser } from "../middleware/auth";
import {
  createUser,
  deleteUser,
  EmailAlreadyExistsError,
  listUsers,
} from "../services/users.service";

const userIdSchema = z.uuid();

export const userRoutes = new Hono<WorkerEnvironment>();

userRoutes.get("/", async (context) => {
  const users = await listUsers(context.env.DB);
  return context.json<ApiData<{ users: User[] }>>({ data: { users } });
});

userRoutes.post("/", async (context) => {
  const body = await readJsonBody(context.req.raw);

  if (!body.ok) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "The request must contain valid JSON.",
    );
  }

  const parsedInput = createUserSchema.safeParse(body.value);

  if (!parsedInput.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid user details.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  try {
    const user = await createUser(context.env.DB, parsedInput.data);
    return context.json<ApiData<{ user: User }>>({ data: { user } }, 201);
  } catch (error) {
    if (error instanceof EmailAlreadyExistsError) {
      return errorResponse(
        context,
        409,
        "EMAIL_ALREADY_EXISTS",
        error.message,
        { email: error.message },
      );
    }

    throw error;
  }
});

userRoutes.delete("/:id", async (context) => {
  const parsedId = userIdSchema.safeParse(context.req.param("id"));

  if (!parsedId.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "The user ID is invalid.",
      { id: "Enter a valid user ID." },
    );
  }

  if (parsedId.data === getCurrentUser(context).id) {
    return errorResponse(
      context,
      409,
      "CANNOT_DELETE_SELF",
      "You cannot delete your own account.",
    );
  }

  if (!(await deleteUser(context.env.DB, parsedId.data))) {
    return errorResponse(context, 404, "NOT_FOUND", "The user was not found.");
  }

  return context.body(null, 204);
});
