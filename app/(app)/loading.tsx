import { Skeleton } from "@/components/ui/skeleton";

export default function JobsLoading() {
  return (
    <main className="container py-6 space-y-6" role="status">
      <span className="sr-only">Loading jobs…</span>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-80 mt-2" />
        </div>
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 flex-1 min-w-[240px]" />
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="hidden sm:block h-4 w-56" />
        </div>
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_420px_160px_64px] gap-4 px-4 py-2.5 border-b bg-muted/30">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <div />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-gradient-to-r from-violet-500/10 via-sky-500/10 to-transparent">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
          </div>
          <ul className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <li
                key={i}
                className="grid md:grid-cols-[minmax(0,1fr)_420px_160px_120px] gap-2 md:gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56 mt-1.5" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <div className="flex items-center">
                  <Skeleton className="h-4 w-28" />
                </div>
                <div className="hidden md:flex items-center">
                  <Skeleton className="h-4 w-16" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
