const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatUnixDate(value: number): string {
  return dateFormatter.format(new Date(value * 1000));
}

export function formatEnumLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
