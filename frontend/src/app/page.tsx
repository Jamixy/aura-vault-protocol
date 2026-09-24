import { Suspense } from "react";
import type { Metadata } from "next";
import DeepLinkHandler from "@/components/DeepLinkHandler";
import { Skeleton } from "@/components/Skeleton";

export const metadata: Metadata = {
  title: "Aura Vault",
  description: "Aura Vault Protocol dashboard",
};

/**
 * Home page — Issue #262: deep-link support for pre-filled deposit/withdraw.
 *
 * DeepLinkHandler uses useSearchParams() which requires a Suspense boundary
 * in Next.js App Router (the hook opts the subtree into dynamic rendering).
 * The fallback renders skeleton cards so the layout doesn't shift on load.
 */
export default function Home() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <DeepLinkHandler />
    </Suspense>
  );
}

function HomeSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {/* Actions skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </main>
  );
}
