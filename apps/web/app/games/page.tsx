"use client";

import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Skeleton from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import { getUpcomingGames, getTeams, ApiError } from "@/lib/api";
import type { UpcomingGame, TeamSummary } from "@/lib/types";

type DateRange = "today" | "7days" | "14days";

function getDateRange(range: DateRange): { from: string; to: string } {
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const days = range === "today" ? 1 : range === "7days" ? 7 : 14;
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  const to = end.toISOString().slice(0, 10);
  return { from, to };
}

function formatLocalTime(iso: string): string {
  if (!iso) return "TBD";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function GamesPage() {
  const [games, setGames] = useState<UpcomingGame[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notDeployed, setNotDeployed] = useState(false);
  const [range, setRange] = useState<DateRange>("7days");
  const [teamFilter, setTeamFilter] = useState("");

  // Load teams for filter dropdown (cached in api.ts)
  useEffect(() => {
    getTeams().then(setTeams).catch(() => {});
  }, []);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotDeployed(false);
    try {
      const { from, to } = getDateRange(range);
      const result = await getUpcomingGames({
        from,
        to,
        teamId: teamFilter || undefined,
        limit: 50,
      });
      setGames(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setNotDeployed(true);
      } else {
        setError("Failed to load games. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [range, teamFilter]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Not deployed fallback
  if (notDeployed) {
    return (
      <div className="space-y-6">
        <PageHeader title="Schedule" subtitle="Upcoming NBA games" />
        <div className="flex min-h-[40vh] flex-col items-center justify-center">
          <div className="text-5xl">📅</div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Schedule is coming soon</h2>
          <p className="mt-2 text-sm text-gray-500">
            The upcoming games feature is being built. Check back later!
          </p>
        </div>
      </div>
    );
  }

  const dateRangeButtons: { label: string; value: DateRange }[] = [
    { label: "Today", value: "today" },
    { label: "Next 7 Days", value: "7days" },
    { label: "Next 14 Days", value: "14days" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Schedule" subtitle="Upcoming NBA games" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range buttons */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {dateRangeButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setRange(btn.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                range === btn.value
                  ? "bg-nba-blue text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Team filter */}
        {teams.length > 0 && (
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-nba-blue focus:outline-none focus:ring-1 focus:ring-nba-blue"
          >
            <option value="">All Teams</option>
            {teams
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchGames} />
      ) : games.length === 0 ? (
        <EmptyState message="No games scheduled in this range. Try a wider window or different team filter." />
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <Card key={game.gameId}>
              <div className="flex items-center justify-between gap-4">
                {/* Away team */}
                <div className="flex-1 text-right">
                  <p className="text-lg font-bold text-gray-900">
                    {game.awayTeam.abbreviation}
                  </p>
                  <p className="text-xs text-gray-500">{game.awayTeam.name}</p>
                  {game.awayTeam.record && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {game.awayTeam.record}
                      {game.awayTeam.last10 && ` (L10: ${game.awayTeam.last10})`}
                    </p>
                  )}
                </div>

                {/* Game info center */}
                <div className="flex flex-col items-center px-4">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {game.status}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold text-nba-blue">
                    @
                  </span>
                  <span className="mt-0.5 text-xs text-gray-500">
                    {formatLocalTime(game.startTime)}
                  </span>
                </div>

                {/* Home team */}
                <div className="flex-1">
                  <p className="text-lg font-bold text-gray-900">
                    {game.homeTeam.abbreviation}
                  </p>
                  <p className="text-xs text-gray-500">{game.homeTeam.name}</p>
                  {game.homeTeam.record && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {game.homeTeam.record}
                      {game.homeTeam.last10 && ` (L10: ${game.homeTeam.last10})`}
                    </p>
                  )}
                </div>
              </div>

              {/* Freshness badge */}
              {game.isStale && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Data may be outdated
                  </span>
                  {game.lastSyncedAt && (
                    <span className="ml-2 text-xs text-gray-400">
                      Last synced: {formatLocalTime(game.lastSyncedAt)}
                    </span>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
