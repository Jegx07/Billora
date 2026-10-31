import { Skeleton } from "@/components/ui/Primitives";

export default function WorkspaceLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-border gap-3">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-3.5 w-80" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-bg-base p-5 shadow-xs">
            <Skeleton className="h-3.5 w-28 mb-3" />
            <Skeleton className="h-7 w-36 mb-2" />
            <Skeleton className="h-3 w-44" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-bg-base p-5 shadow-xs space-y-3">
        <Skeleton className="h-8 w-72 mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
