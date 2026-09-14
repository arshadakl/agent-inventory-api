interface PagePlaceholderProps {
  description: string;
  title: string;
}

export function PagePlaceholder({ description, title }: PagePlaceholderProps) {
  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </main>
  );
}
