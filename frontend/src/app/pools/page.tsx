"use client";

import { useState } from "react";
import PoolsList from "@/components/PoolsList";
import CreatePoolModal from "@/components/CreatePoolModal";

export default function PoolsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Liquidity Pools</h1>
          <p className="text-dark-400 mt-1">
            Provide liquidity and earn trading fees
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition-colors"
        >
          + Create Pool
        </button>
      </div>
      <PoolsList />
      {showCreateModal && (
        <CreatePoolModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
