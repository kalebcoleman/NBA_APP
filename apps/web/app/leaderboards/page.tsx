"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import DataTable from "@/components/DataTable";
import FeatureGate from "@/components/FeatureGate";
import { useAuth } from "@/lib/auth-context";
import { getLeaderboard } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";

const statOptions = [
  { value: "ppg", label: "Points Per Game" },
  { value: "rpg", label: "Rebounds Per Game" },
  { value: "apg", label: "Assists Per Game" },
  { value: "fgPct", label: "FG%" },
  { value: "threePct", label: "3PT%" },
  { value: "trueShootingPct", label: "True Shooting %" },
  { value: "usagePct", label: "Usage Rate" },
  { value: "pie", label: "PIE" },
];

export default function LeaderboardsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stat, setStat] = useState("ppg");
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const freeLimit = user?.limits.leaderboardMaxRows ?? 10;
  const isPremium = user?.plan === "premium";

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getLeaderboard(stat, { limit: isPremium ? 50 : freeLimit });
    setLeaders(data);
    setLoading(false);
  }, [stat, isPremium, freeLimit]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Leaderboards" subtitle="NBA stat leaders for the current season" />

      <div className="mb-4 flex flex-wrap gap-2">
        {statOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setStat(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${stat === opt.value
                ? "bg-nba-blue text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <Card>
        <DataTable
          columns={[
            { key: "rank", header: "#", align: "center" },
            {
              key: "name", header: "Player", sortable: true, render: (r: LeaderboardEntry) => (
                <span className="font-medium text-gray-900">{r.name}</span>
              )
            },
            { key: "team", header: "Team" },
            { key: "gamesPlayed", header: "GP", align: "right" },
            {
              key: "value", header: statOptions.find((s) => s.value === stat)?.label ?? stat, align: "right", sortable: true, render: (r: LeaderboardEntry) => (
                <span className="font-bold text-nba-blue">
                  {['fgPct', 'threePct', 'trueShootingPct', 'usagePct', 'pie'].includes(stat)
                    ? r.value.toFixed(2)
                    : r.value.toFixed(1)}
                </span>
              )
            },
          ]}
          data={leaders}
          isLoading={loading}
          onRowClick={(row) => router.push(`/players/${row.playerId}`)}
        />

        {!isPremium && leaders.length >= freeLimit && (
          <div className="mt-4">
            <FeatureGate feature="full_leaderboard">
              <div />
            </FeatureGate>
          </div>
        )}
      </Card>
    </div>
  );
}
