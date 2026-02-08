"use client";

import { useUpgrade } from "@/lib/upgrade";

interface LimitReachedProps {
  feature: string;
  message?: string;
}

export default function LimitReached({
  feature,
  message,
}: LimitReachedProps) {
  const { startUpgrade, error } = useUpgrade();

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <div className="text-3xl">🚫</div>
      <h3 className="mt-2 text-lg font-bold text-gray-900">Limit Reached</h3>
      <p className="mt-1 text-sm text-gray-600">
        {message || `You've used all your free ${feature} for today.`}
      </p>
      <button onClick={() => startUpgrade()} className="btn-gold mt-4">
        Upgrade for Unlimited Access
      </button>
      {error && (
        <div className="mt-3 rounded bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</div>
      )}
    </div>
  );
}
