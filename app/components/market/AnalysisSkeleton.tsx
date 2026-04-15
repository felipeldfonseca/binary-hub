'use client';

export default function AnalysisSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="h-3 w-32 bg-white/10 rounded mb-2" />
          <div className="h-8 w-48 bg-white/10 rounded mb-2" />
          <div className="h-3 w-40 bg-white/10 rounded" />
        </div>
        <div className="text-right">
          <div className="h-7 w-24 bg-white/10 rounded mb-2" />
          <div className="h-4 w-16 bg-white/10 rounded" />
        </div>
      </div>

      {/* Hero section skeleton */}
      <div className="p-7 rounded-2xl bg-white/5 border border-white/10 mb-4">
        <div className="flex gap-6">
          {/* Score ring placeholder */}
          <div className="w-[120px] h-[120px] rounded-full bg-white/10 flex-shrink-0" />
          <div className="flex-1">
            <div className="h-6 w-40 bg-white/10 rounded mb-4" />
            <div className="h-4 w-full bg-white/10 rounded mb-2" />
            <div className="h-4 w-3/4 bg-white/10 rounded mb-2" />
            <div className="h-4 w-1/2 bg-white/10 rounded" />
          </div>
        </div>
        <div className="mt-5">
          <div className="h-3 w-24 bg-white/10 rounded mb-3" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-white/10 rounded" />
            <div className="h-4 w-5/6 bg-white/10 rounded" />
            <div className="h-4 w-4/5 bg-white/10 rounded" />
          </div>
        </div>
      </div>

      {/* Overview banner skeleton */}
      <div className="p-5 rounded-xl bg-primary/5 border border-primary/10 mb-4">
        <div className="h-3 w-24 bg-white/10 rounded mb-2" />
        <div className="h-4 w-full bg-white/10 rounded mb-2" />
        <div className="h-4 w-3/4 bg-white/10 rounded" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white/5 border border-white/10"
          >
            <div className="flex justify-between mb-4">
              <div>
                <div className="h-4 w-32 bg-white/10 rounded mb-1" />
                <div className="h-3 w-24 bg-white/10 rounded" />
              </div>
              <div className="h-6 w-20 bg-white/10 rounded-full" />
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 w-full bg-white/10 rounded" />
              <div className="h-4 w-5/6 bg-white/10 rounded" />
            </div>
            <div className="space-y-1.5">
              {[1, 2, 3].map((j) => (
                <div
                  key={j}
                  className="h-10 w-full bg-white/5 rounded-xl border border-white/5"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Full-width card skeleton */}
      <div className="mt-4 p-5 rounded-2xl bg-white/5 border border-white/10">
        <div className="flex justify-between mb-4">
          <div>
            <div className="h-4 w-32 bg-white/10 rounded mb-1" />
            <div className="h-3 w-24 bg-white/10 rounded" />
          </div>
          <div className="h-6 w-20 bg-white/10 rounded-full" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 w-full bg-white/5 rounded-xl border border-white/5"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
