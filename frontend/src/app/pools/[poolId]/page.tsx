"use client";

import { useParams } from "next/navigation";
import PoolDetail from "@/components/PoolDetail";

export default function PoolDetailPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  return (
    <div className="max-w-4xl mx-auto">
      <PoolDetail poolId={poolId} />
    </div>
  );
}
