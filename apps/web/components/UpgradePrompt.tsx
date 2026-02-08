"use client";

import { useUpgrade } from "@/lib/upgrade";

interface UpgradePromptProps {
  message?: string;
  compact?: boolean;
}

export default function UpgradePrompt({
  message = "Unlock this feature with NBA Analytics Premium",
  compact = false,
}: UpgradePromptProps) {
  const { startUpgrade, error } = useUpgrade();

  if (compact) {
    return (
      <div>
        <div className="flex items-center gap-2 rounded-lg bg-nba-gold/10 px-3 py-2">
          <span className="text-xs text-gray-700">{message}</span>
          <button onClick={() => startUpgrade()} className="btn-gold !px-2 !py-1 !text-xs">
            Upgrade
          </button>
        </div>
        {error && (
          <div className="mt-1 rounded bg-amber-50 px-3 py-1 text-xs text-amber-800">{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-nba-gold/50 bg-nba-gold/5 p-6 text-center">
      <div className="text-3xl">🔒</div>
      <h3 className="mt-2 text-lg font-bold text-gray-900">Premium Feature</h3>
      <p className="mt-1 text-sm text-gray-600">{message}</p>
      <button onClick={() => startUpgrade()} className="btn-gold mt-4">
        Upgrade to Premium — $9.99/mo
      </button>
      <p className="mt-2 text-xs text-gray-400">Cancel anytime. 7-day free trial.</p>
      {error && (
        <div className="mt-3 rounded bg-amber-50 px-4 py-2 text-sm text-amber-800">{error}</div>
      )}
    </div>
  );
}
