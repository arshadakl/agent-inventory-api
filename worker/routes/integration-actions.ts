import { integrationActionSchema } from "@shared/schemas/integration";
import type { ApiData } from "@shared/types/api";
import {
  priceContext,
  type AvailabilityResult,
  type PropertySearchResult,
} from "@shared/types/integration";
import type { Property } from "@shared/types/property";
import { Hono } from "hono";

import type { WorkerEnvironment } from "../env";
import { readJsonBody } from "../lib/request";
import { errorResponse, getZodFieldErrors } from "../lib/response";
import {
  findPropertyById,
  findSimilarProperties,
  searchPropertiesForIntegration,
} from "../services/properties.service";

type IntegrationResult =
  | AvailabilityResult
  | PropertySearchResult
  | { priceContext: typeof priceContext; property: Property };

export const integrationActionRoutes = new Hono<WorkerEnvironment>();

integrationActionRoutes.post("/execute", async (context) => {
  const body = await readJsonBody(context.req.raw);

  if (!body.ok) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "The action request must contain valid JSON.",
    );
  }

  const parsedAction = integrationActionSchema.safeParse(body.value);

  if (!parsedAction.success) {
    return errorResponse(
      context,
      400,
      "VALIDATION_ERROR",
      "Invalid integration action.",
      getZodFieldErrors(parsedAction.error),
    );
  }

  try {
    const result = await executeAction(context.env.DB, parsedAction.data);
    return context.json<ApiData<{ action: string; result: IntegrationResult }>>(
      {
        data: { action: parsedAction.data.action, result },
      },
    );
  } catch (error) {
    if (error instanceof IntegrationPropertyNotFoundError) {
      return errorResponse(context, 404, "NOT_FOUND", error.message);
    }

    throw error;
  }
});

async function executeAction(
  database: D1Database,
  action: ReturnType<typeof integrationActionSchema.parse>,
): Promise<IntegrationResult> {
  switch (action.action) {
    case "search_properties":
      return {
        properties: await searchPropertiesForIntegration(
          database,
          action.input,
        ),
        priceContext,
      };
    case "get_property": {
      const property = await requireProperty(database, action.input.propertyId);
      return { property, priceContext };
    }
    case "check_availability": {
      const property = await requireProperty(database, action.input.propertyId);
      return {
        propertyId: property.id,
        status: property.status,
        available: property.status === "available",
        priceContext,
      };
    }
    case "similar_properties": {
      const property = await requireProperty(database, action.input.propertyId);
      return {
        properties: await findSimilarProperties(
          database,
          property,
          action.input.limit,
        ),
        priceContext,
      };
    }
  }
}

async function requireProperty(
  database: D1Database,
  propertyId: string,
): Promise<Property> {
  const property = await findPropertyById(database, propertyId);

  if (!property) {
    throw new IntegrationPropertyNotFoundError();
  }

  return property;
}

class IntegrationPropertyNotFoundError extends Error {
  constructor() {
    super("The property was not found.");
    this.name = "IntegrationPropertyNotFoundError";
  }
}
