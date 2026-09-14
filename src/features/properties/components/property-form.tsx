import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import {
  listingTypes,
  propertyInputSchema,
  propertyStatuses,
  propertyTypes,
  type PropertyInput,
} from "@shared/schemas/property";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError } from "@/lib/api-client";
import { formatEnumLabel } from "@/lib/format";

type PropertyFormValues = z.input<typeof propertyInputSchema>;

interface PropertyFormProps {
  defaultValues?: PropertyInput;
  error: Error | null;
  loading: boolean;
  onSubmit: (input: PropertyInput) => Promise<void>;
  submitLabel: string;
}

export function PropertyForm({
  defaultValues,
  error,
  loading,
  onSubmit,
  submitLabel,
}: PropertyFormProps) {
  const form = useForm<PropertyFormValues, unknown, PropertyInput>({
    resolver: zodResolver(propertyInputSchema),
    defaultValues: defaultValues ?? {
      title: "",
      propertyType: "apartment",
      listingType: "sale",
      furnished: false,
      location: "",
      areaSqft: null,
      bedrooms: null,
      bathrooms: null,
      status: "available",
      description: null,
    },
  });
  const errors = form.formState.errors;
  const submit = form.handleSubmit(async (input) => {
    try {
      await onSubmit(input);
    } catch {
      // The parent mutation owns the safe server error rendered below.
    }
  });

  return (
    <form className="space-y-8" noValidate onSubmit={submit}>
      {error ? (
        <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
          {getSubmitError(error)}
        </Alert>
      ) : null}

      <section className="grid gap-5 sm:grid-cols-2">
        <FormField
          className="sm:col-span-2"
          error={errors.title?.message}
          label="Property title"
          name="title"
        >
          <Input
            aria-describedby="title-error"
            aria-invalid={Boolean(errors.title)}
            id="title"
            placeholder="Marina View Apartment"
            {...form.register("title")}
          />
        </FormField>

        <FormField
          error={errors.propertyType?.message}
          label="Property type"
          name="propertyType"
        >
          <Select
            aria-describedby="propertyType-error"
            aria-invalid={Boolean(errors.propertyType)}
            id="propertyType"
            {...form.register("propertyType")}
          >
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {formatEnumLabel(type)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          error={errors.listingType?.message}
          label="Listing type"
          name="listingType"
        >
          <Select
            aria-describedby="listingType-error"
            aria-invalid={Boolean(errors.listingType)}
            id="listingType"
            {...form.register("listingType")}
          >
            {listingTypes.map((type) => (
              <option key={type} value={type}>
                {formatEnumLabel(type)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          className="sm:col-span-2"
          error={errors.location?.message}
          label="Location"
          name="location"
        >
          <Input
            aria-describedby="location-error"
            aria-invalid={Boolean(errors.location)}
            id="location"
            placeholder="Dubai Marina"
            {...form.register("location")}
          />
        </FormField>

        <FormField error={errors.price?.message} label="Price" name="price">
          <Input
            aria-describedby="price-error"
            aria-invalid={Boolean(errors.price)}
            id="price"
            inputMode="numeric"
            min="0"
            placeholder="1250000"
            step="1"
            type="number"
            {...form.register("price", { setValueAs: requiredNumber })}
          />
        </FormField>

        <FormField error={errors.status?.message} label="Status" name="status">
          <Select
            aria-describedby="status-error"
            aria-invalid={Boolean(errors.status)}
            id="status"
            {...form.register("status")}
          >
            {propertyStatuses.map((status) => (
              <option key={status} value={status}>
                {formatEnumLabel(status)}
              </option>
            ))}
          </Select>
        </FormField>

        <OptionalNumberField
          error={errors.areaSqft?.message}
          label="Area (sq ft)"
          name="areaSqft"
          register={form.register}
        />
        <OptionalNumberField
          error={errors.bedrooms?.message}
          label="Bedrooms"
          name="bedrooms"
          register={form.register}
        />
        <OptionalNumberField
          error={errors.bathrooms?.message}
          label="Bathrooms"
          name="bathrooms"
          register={form.register}
        />

        <label className="flex min-h-10 items-center gap-3 self-end rounded-md border bg-muted/25 px-3">
          <input
            className="size-4 rounded border-input accent-primary"
            type="checkbox"
            {...form.register("furnished")}
          />
          <span className="text-sm font-medium">Furnished</span>
        </label>

        <FormField
          className="sm:col-span-2"
          error={errors.description?.message}
          label="Description"
          name="description"
        >
          <Textarea
            aria-describedby="description-error"
            aria-invalid={Boolean(errors.description)}
            id="description"
            placeholder="Add useful internal listing details…"
            {...form.register("description")}
          />
        </FormField>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link to="/properties">Cancel</Link>
        </Button>
        <Button disabled={loading} type="submit">
          {loading ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {loading ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

interface FormFieldProps {
  children: ReactNode;
  className?: string;
  error: string | undefined;
  label: string;
  name: string;
}

function FormField({
  children,
  className,
  error,
  label,
  name,
}: FormFieldProps) {
  return (
    <div className={className ? `space-y-2 ${className}` : "space-y-2"}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      <p className="min-h-5 text-sm text-destructive" id={`${name}-error`}>
        {error}
      </p>
    </div>
  );
}

interface OptionalNumberFieldProps {
  error: string | undefined;
  label: string;
  name: "areaSqft" | "bedrooms" | "bathrooms";
  register: UseFormRegister<PropertyFormValues>;
}

function OptionalNumberField({
  error,
  label,
  name,
  register,
}: OptionalNumberFieldProps) {
  return (
    <FormField error={error} label={label} name={name}>
      <Input
        aria-describedby={`${name}-error`}
        aria-invalid={Boolean(error)}
        id={name}
        inputMode="numeric"
        min="0"
        placeholder="Optional"
        step="1"
        type="number"
        {...register(name, { setValueAs: optionalNumber })}
      />
    </FormField>
  );
}

function requiredNumber(value: unknown): number {
  return value === "" ? Number.NaN : Number(value);
}

function optionalNumber(value: unknown): number | null {
  return value === "" || value === null ? null : Number(value);
}

function getSubmitError(error: Error): string {
  return error instanceof ApiClientError
    ? error.message
    : "The property could not be saved. Please try again.";
}
