import { Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import type { Property } from "@shared/types/property";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEnumLabel, formatInteger, formatUnixDate } from "@/lib/format";

interface InventoryResultsProps {
  onDelete: (property: Property) => void;
  properties: Property[];
}

export function InventoryResults({
  onDelete,
  properties,
}: InventoryResultsProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-muted/45">
              <TableHead>Property</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Listing</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-20">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell>
                  <p className="font-medium">{property.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {property.location} · Added{" "}
                    {formatUnixDate(property.createdAt)}
                  </p>
                </TableCell>
                <TableCell>{formatEnumLabel(property.propertyType)}</TableCell>
                <TableCell>{formatEnumLabel(property.listingType)}</TableCell>
                <TableCell>
                  <PropertyStatusBadge status={property.status} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatInteger(property.price)}
                </TableCell>
                <TableCell>
                  <PropertyActions onDelete={onDelete} property={property} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 md:hidden">
        {properties.map((property) => (
          <Card className="gap-4 py-5" key={property.id}>
            <CardHeader className="grid-cols-[1fr_auto] px-5">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {property.title}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {property.location}
                </p>
              </div>
              <PropertyActions onDelete={onDelete} property={property} />
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 px-5">
              <PropertyStatusBadge status={property.status} />
              <Badge variant="outline">
                {formatEnumLabel(property.propertyType)}
              </Badge>
              <Badge variant="outline">For {property.listingType}</Badge>
              <span className="ml-auto font-semibold tabular-nums">
                {formatInteger(property.price)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function PropertyActions({
  onDelete,
  property,
}: {
  onDelete: (property: Property) => void;
  property: Property;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button asChild size="icon" variant="ghost">
        <Link
          aria-label={`Edit ${property.title}`}
          to={`/properties/${property.id}/edit`}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Link>
      </Button>
      <Button
        aria-label={`Delete ${property.title}`}
        onClick={() => onDelete(property)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}

function PropertyStatusBadge({ status }: { status: Property["status"] }) {
  const styles = {
    available: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sold: "border-slate-200 bg-slate-100 text-slate-700",
    rented: "border-blue-200 bg-blue-50 text-blue-700",
  } as const;

  return (
    <Badge className={styles[status]} variant="outline">
      <span className="size-1.5 rounded-full bg-current" />
      {formatEnumLabel(status)}
    </Badge>
  );
}
