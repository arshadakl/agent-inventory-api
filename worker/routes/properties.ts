import { z } from "zod";

import {
  propertyInputSchema,
  propertyListQuerySchema,
  propertyUpdateSchema,
} from "@shared/schemas/property";
import type { ApiData } from "@shared/types/api";
import type { Property, PropertyList } from "@shared/types/property";
import { Hono } from "hono";

import type { WorkerEnvironment } from "../env";
import { readJsonBody } from "../lib/request";
import { errorResponse, getZodFieldErrors } from "../lib/response";
import {
  createProperty,
  deleteProperty,
  findPropertyById,
  listProperties,
  updateProperty,
} from "../services/properties.service";

const propertyIdSchema = z.uuid();

export const propertyRoutes = new Hono<WorkerEnvironment>();

propertyRoutes.get("/", async (context) => {
  const parsedQuery = propertyListQuerySchema.safeParse(context.req.query());

  if (!parsedQuery.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid property filters.",
      getZodFieldErrors(parsedQuery.error),
    );
  }

  const result = await listProperties(context.env.DB, parsedQuery.data);

  return context.json<ApiData<PropertyList>>({ data: result });
});

propertyRoutes.get("/:id", async (context) => {
  const id = parsePropertyId(context.req.param("id"));

  if (!id) {
    return invalidPropertyIdResponse(context);
  }

  const property = await findPropertyById(context.env.DB, id);

  if (!property) {
    return propertyNotFoundResponse(context);
  }

  return context.json<ApiData<{ property: Property }>>({ data: { property } });
});

propertyRoutes.post("/", async (context) => {
  const body = await readJsonBody(context.req.raw);

  if (!body.ok) {
    return invalidJsonResponse(context);
  }

  const parsedInput = propertyInputSchema.safeParse(body.value);

  if (!parsedInput.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid property details.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  const property = await createProperty(context.env.DB, parsedInput.data);

  return context.json<ApiData<{ property: Property }>>(
    { data: { property } },
    201,
  );
});

propertyRoutes.patch("/:id", async (context) => {
  const id = parsePropertyId(context.req.param("id"));

  if (!id) {
    return invalidPropertyIdResponse(context);
  }

  const body = await readJsonBody(context.req.raw);

  if (!body.ok) {
    return invalidJsonResponse(context);
  }

  const parsedInput = propertyUpdateSchema.safeParse(body.value);

  if (!parsedInput.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid property details.",
      getZodFieldErrors(parsedInput.error),
    );
  }

  const property = await updateProperty(context.env.DB, id, parsedInput.data);

  if (!property) {
    return propertyNotFoundResponse(context);
  }

  return context.json<ApiData<{ property: Property }>>({ data: { property } });
});

propertyRoutes.delete("/:id", async (context) => {
  const id = parsePropertyId(context.req.param("id"));

  if (!id) {
    return invalidPropertyIdResponse(context);
  }

  if (!(await deleteProperty(context.env.DB, id))) {
    return propertyNotFoundResponse(context);
  }

  return context.body(null, 204);
});

function parsePropertyId(value: string): string | null {
  const result = propertyIdSchema.safeParse(value);
  return result.success ? result.data : null;
}

function invalidJsonResponse(
  context: Parameters<typeof errorResponse>[0],
): Response {
  return errorResponse(
    context,
    400,
    "VALIDATION_ERROR",
    "The request must contain valid JSON.",
  );
}

function invalidPropertyIdResponse(
  context: Parameters<typeof errorResponse>[0],
): Response {
  return errorResponse(
    context,
    400,
    "VALIDATION_ERROR",
    "The property ID is invalid.",
    { id: "Enter a valid property ID." },
  );
}

function propertyNotFoundResponse(
  context: Parameters<typeof errorResponse>[0],
): Response {
  return errorResponse(
    context,
    404,
    "NOT_FOUND",
    "The property was not found.",
  );
}
