import { DataTabs } from "./data-tabs";

// The Data page: the club's statistics, and searches of everyone who has
// signed up and every build. Every admin, viewers included, sees all of it.
export default function DataLayout({ children }: LayoutProps<"/admin/data">) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Data</h1>
          <p className="text-sm text-muted-foreground">
            The club&apos;s numbers, and everyone and every build on the site.
          </p>
        </div>
        <DataTabs />
      </div>
      {children}
    </div>
  );
}
