"use client";

import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Protocol Dashboard</h1>
      <p className="text-dark-400 mb-8">
        Overview of protocol performance and metrics
      </p>
      <Dashboard />
    </div>
  );
}
