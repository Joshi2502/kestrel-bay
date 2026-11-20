import { AppHeader } from "@/components/AppHeader";
import { PageSkeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <>
      <AppHeader />
      <PageSkeleton rows={3} />
    </>
  );
}
