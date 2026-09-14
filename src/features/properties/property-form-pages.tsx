import { ArrowLeft, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import type { PropertyInput } from "@shared/schemas/property";
import type { Property } from "@shared/types/property";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { PropertyForm } from "./components/property-form";
import {
  useCreateProperty,
  useProperty,
  useUpdateProperty,
} from "./property-hooks";

const propertyIdSchema = z.uuid();

export function CreatePropertyPage() {
  const createProperty = useCreateProperty();
  const navigate = useNavigate();

  async function submit(input: PropertyInput): Promise<void> {
    await createProperty.mutateAsync(input);
    navigate("/properties", {
      replace: true,
      state: { notice: "Property added successfully." },
    });
  }

  return (
    <PropertyFormPage
      description="Add the core details your team needs to manage this listing."
      title="Add property"
    >
      <PropertyForm
        error={createProperty.error}
        loading={createProperty.isPending}
        onSubmit={submit}
        submitLabel="Add property"
      />
    </PropertyFormPage>
  );
}

export function EditPropertyPage() {
  const params = useParams();
  const parsedId = propertyIdSchema.safeParse(params.id);

  if (!parsedId.success) {
    return <InvalidPropertyState />;
  }

  return <EditPropertyForm id={parsedId.data} />;
}

function EditPropertyForm({ id }: { id: string }) {
  const property = useProperty(id);
  const updateProperty = useUpdateProperty(id);
  const navigate = useNavigate();

  async function submit(input: PropertyInput): Promise<void> {
    await updateProperty.mutateAsync(input);
    navigate("/properties", {
      replace: true,
      state: { notice: "Property updated successfully." },
    });
  }

  if (property.isPending) {
    return (
      <main className="p-5 sm:p-8 lg:p-10">
        <div className="mx-auto max-w-4xl space-y-5">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-[620px] w-full" />
        </div>
      </main>
    );
  }

  if (property.isError) {
    return <InvalidPropertyState />;
  }

  return (
    <PropertyFormPage
      description="Update listing details and availability."
      title="Edit property"
    >
      <PropertyForm
        defaultValues={toPropertyInput(property.data)}
        error={updateProperty.error}
        loading={updateProperty.isPending}
        onSubmit={submit}
        submitLabel="Save changes"
      />
    </PropertyFormPage>
  );
}

function PropertyFormPage({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <Button asChild className="-ml-3 mb-3" size="sm" variant="ghost">
            <Link to="/properties">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to properties
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </header>
        <Card>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}

function InvalidPropertyState() {
  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-xl rounded-xl border bg-card px-6 py-14 text-center">
        <TriangleAlert
          aria-hidden="true"
          className="mx-auto size-8 text-destructive"
        />
        <h1 className="mt-4 text-lg font-semibold">Property not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This property may have been deleted or the address is invalid.
        </p>
        <Button asChild className="mt-6">
          <Link to="/properties">Return to properties</Link>
        </Button>
      </div>
    </main>
  );
}

function toPropertyInput(property: Property): PropertyInput {
  return {
    title: property.title,
    propertyType: property.propertyType,
    listingType: property.listingType,
    furnished: property.furnished,
    location: property.location,
    price: property.price,
    areaSqft: property.areaSqft,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    status: property.status,
    description: property.description,
  };
}
