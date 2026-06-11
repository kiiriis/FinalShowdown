import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ChartCardSkeleton({
  bodyHeight,
  className,
  withTabs,
}: {
  bodyHeight: number;
  className?: string;
  withTabs?: boolean;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3.5 w-56" />
      </CardHeader>
      <CardContent>
        {withTabs && <Skeleton className="h-9 w-64 mb-3" />}
        <Skeleton className="w-full" style={{ height: bodyHeight }} />
      </CardContent>
    </Card>
  );
}

function ListCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3.5 w-52" />
      </CardHeader>
      <CardContent className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Skeleton className="h-7 w-7 rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44 mt-1.5" />
            </div>
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <main className="container py-6 space-y-6" role="status">
      <span className="sr-only">Loading dashboard…</span>
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <ChartCardSkeleton bodyHeight={260} className="lg:col-span-1" />
        <ChartCardSkeleton bodyHeight={280} className="lg:col-span-2" />
      </div>
      <ChartCardSkeleton bodyHeight={280} withTabs />
      <ChartCardSkeleton bodyHeight={260} />
      <div className="grid lg:grid-cols-2 gap-4">
        <ListCardSkeleton />
        <ListCardSkeleton />
      </div>
    </main>
  );
}
