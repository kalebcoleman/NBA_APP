"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import BarChartWrapper from "@/components/BarChartWrapper";
import UpgradePrompt from "@/components/UpgradePrompt";
import { useAuth } from "@/lib/auth-context";
import { comparePlayers, getPlayers } from "@/lib/api";
import type { ComparisonPlayer, PlayerSummary } from "@/lib/types";

export default function ComparePage() {
  const { user } = useAuth();
  const [searchResults, setSearchResults] = useState<PlayerSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<ComparisonPlayer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const maxPlayers = user?.plan === "premium" ? 5 : (user?.limits.compareMaxPlayers ?? 2);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await getPlayers({ search: q, limit: 5 });
    setSearchResults(res.data.filter((p) => !selectedIds.includes(p.playerId)));
  };

  const addPlayer = (player: PlayerSummary) => {
    if (selectedIds.length >= maxPlayers) return;
    setSelectedIds((prev) => [...prev, player.playerId]);
    setSearchResults([]);
    setSearchQuery("");
  };

  const removePlayer = (id: string) => {
    setSelectedIds((prev) => prev.filter((pid) => pid !== id));
    setComparison(null);
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) return;
    setLoading(true);
    const data = await comparePlayers(selectedIds);
    setComparison(data);
    setLoading(false);
  };

  const statKeys = comparison?.[0] ? Object.keys(comparison[0].stats) : [];
  const colors = ["#1d428a", "#c8102e", "#fdb927", "#17408b", "#552583"];

  return (
    <div>
      <PageHeader title="Compare Players" subtitle="Side-by-side stats comparison" />

      <Card className="mb-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id, i) => {
              const player = comparison?.find((p) => p.playerId === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full bg-nba-blue/10 px-3 py-1 text-sm font-medium text-nba-blue"
                >
                  {player?.name ?? `Player ${id}`}
                  <button onClick={() => removePlayer(id)} className="ml-1 text-nba-blue/60 hover:text-nba-blue">
                    ×
                  </button>
                </span>
              );
            })}
          </div>

          {selectedIds.length < maxPlayers && (
            <div className="relative max-w-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search for a player to add..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-nba-blue focus:outline-none focus:ring-2 focus:ring-nba-blue/20"
              />
              {searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  {searchResults.map((p) => (
                    <button
                      key={p.playerId}
                      onClick={() => addPlayer(p)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium">{p.name}</span>
                      <span className="text-xs text-gray-400">{p.team} | {p.position}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedIds.length >= maxPlayers && user?.plan !== "premium" && (
            <UpgradePrompt compact message="Compare up to 5 players with Premium" />
          )}

          <button
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || loading}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Comparing..." : "Compare"}
          </button>
        </div>
      </Card>

      {comparison && (
        <div className="space-y-6">
          {/* Stat Table */}
          <Card title="Stats Comparison">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 text-left">Stat</th>
                    {comparison.map((p) => (
                      <th key={p.playerId} className="px-3 py-2 text-right">{p.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statKeys.map((key) => (
                    <tr key={key} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-700 uppercase text-xs">{key}</td>
                      {comparison.map((p) => {
                        const val = p.stats[key];
                        const maxVal = Math.max(...comparison.map((cp) => cp.stats[key]));
                        return (
                          <td key={p.playerId} className={`px-3 py-2 text-right ${val === maxVal ? "font-bold text-nba-blue" : ""}`}>
                            {val.toFixed(1)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Bar Charts per Stat */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statKeys.map((key) => (
              <Card key={key} title={key.toUpperCase()}>
                <BarChartWrapper
                  data={comparison.map((p, i) => ({
                    name: p.name.split(" ").pop(),
                    value: p.stats[key],
                    fill: colors[i % colors.length],
                  }))}
                  xKey="name"
                  yKey="value"
                  height={200}
                />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
