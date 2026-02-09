"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import ShotChart from "@/components/ShotChart";
import FeatureGate from "@/components/FeatureGate";
import LineChartWrapper from "@/components/LineChartWrapper";
import UpgradePrompt from "@/components/UpgradePrompt";
import ErrorState from "@/components/ErrorState";
import Skeleton from "@/components/Skeleton";
import { useAuth } from "@/lib/auth-context";
import { getPlayer, getPlayerGameLog, getPlayerShots } from "@/lib/api";
import type { PlayerDetail, GameLogEntry, ShotData } from "@/lib/types";

const FREE_GAME_LIMIT = 5;
const PREMIUM_PAGE_SIZE = 20;

export default function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>();
  const { user } = useAuth();
  const isPremium = user?.plan === "premium";

  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [shots, setShots] = useState<ShotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Pagination state for premium users
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [p, gl, sh] = await Promise.all([
          getPlayer(playerId),
          getPlayerGameLog(playerId),
          getPlayerShots(playerId),
        ]);
        setPlayer(p);
        setGameLog(gl);
        setShots(sh);
        // If premium and we got a full page, there may be more
        if (isPremium && gl.length >= PREMIUM_PAGE_SIZE) {
          setHasMore(true);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [playerId, isPremium]);

  const loadMore = useCallback(async () => {
    if (!isPremium || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await getPlayerGameLog(playerId, {
        limit: PREMIUM_PAGE_SIZE,
        offset: gameLog.length,
      });
      setGameLog((prev) => [...prev, ...more]);
      if (more.length < PREMIUM_PAGE_SIZE) {
        setHasMore(false);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [isPremium, loadingMore, playerId, gameLog.length]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !player) {
    return <ErrorState message="Failed to load player data" onRetry={() => window.location.reload()} />;
  }

  const sa = player.seasonAverages;

  const freeTierNote = "Free plan shows last 5 games. Upgrade for full game logs, shot chart history, and trends.";

  // Frontend enforcement: cap data for free users even if API returns more
  const displayGameLog = isPremium ? gameLog : gameLog.slice(0, FREE_GAME_LIMIT);

  // For free users, restrict shots to only the game IDs in the capped game log
  const displayShots = isPremium
    ? shots
    : (() => {
      const allowedGameIds = new Set(displayGameLog.map((g) => g.gameId));
      return shots.filter((s) => allowedGameIds.has(s.gameId));
    })();

  // Trend data uses the capped game log
  const trendData = [...displayGameLog].reverse().map((g) => ({
    date: g.date.slice(5),
    points: g.points,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={player.name}
        subtitle={`${player.team} | #${player.jerseyNum} | ${player.position}`}
        actions={
          <Link href="/players" className="btn-secondary text-sm">
            &larr; Back to Players
          </Link>
        }
      />

      {/* Season Averages */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <StatCard label="PPG" value={sa.ppg.toFixed(1)} />
        <StatCard label="RPG" value={sa.rpg.toFixed(1)} />
        <StatCard label="APG" value={sa.apg.toFixed(1)} />
        <StatCard label="FG%" value={(sa.fgPct * 100).toFixed(2) + "%"} />
        <StatCard label="3PT%" value={(sa.threePct * 100).toFixed(2) + "%"} />
        <StatCard label="FT%" value={(sa.ftPct * 100).toFixed(2) + "%"} />
        <StatCard label="GP" value={sa.gp} />
      </div>

      {/* Advanced Metrics (Premium) */}
      <FeatureGate feature="advanced_metrics">
        <Card title="Advanced Metrics">
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
            {Object.entries(player.advancedMetrics).map(([key, val]) => (
              <div key={key}>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </p>
                <p className="mt-0.5 text-lg font-bold text-gray-900">
                  {typeof val === "number" ? (val < 1 && val > -1 && val !== 0 ? (val * 100).toFixed(2) + "%" : val.toFixed(2)) : val}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </FeatureGate>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Shot Chart */}
        <Card title="Shot Chart">
          {!isPremium && displayShots.length > 0 && (
            <UpgradePrompt compact message={freeTierNote} />
          )}
          {displayShots.length > 0 ? (
            <ShotChart
              shots={displayShots}
              label={!isPremium ? `Recent ${FREE_GAME_LIMIT} games` : undefined}
            />
          ) : (
            <div className="py-12 text-center text-sm text-gray-500">
              No shot data available for this player.
            </div>
          )}
        </Card>

        {/* Scoring Trend */}
        <Card title={isPremium ? "Scoring Trend" : `Recent Scoring Trend (Last ${FREE_GAME_LIMIT} Games)`}>
          {!isPremium && displayGameLog.length > 0 && (
            <UpgradePrompt compact message={freeTierNote} />
          )}
          {trendData.length > 0 ? (
            <LineChartWrapper
              data={trendData}
              xKey="date"
              yKeys={[{ key: "points", color: "#c8102e", name: "Points" }]}
              height={350}
            />
          ) : (
            <p className="py-12 text-center text-sm text-gray-500">No game log data</p>
          )}
        </Card>
      </div>

      {/* Game Log */}
      <Card title="Recent Games">
        {!isPremium && displayGameLog.length > 0 && (
          <UpgradePrompt compact message={freeTierNote} />
        )}
        <DataTable
          columns={[
            { key: "date", header: "Date" },
            { key: "opponent", header: "Opp" },
            {
              key: "result", header: "Result", render: (r: GameLogEntry) => (
                <span className={r.result === "W" ? "font-semibold text-green-700" : "text-red-600"}>
                  {r.result}
                </span>
              )
            },
            { key: "minutes", header: "MIN" },
            { key: "points", header: "PTS", align: "right", sortable: true },
            { key: "rebounds", header: "REB", align: "right", sortable: true },
            { key: "assists", header: "AST", align: "right", sortable: true },
            { key: "fgm", header: "FGM", align: "right" },
            { key: "fga", header: "FGA", align: "right" },
            { key: "threePm", header: "3PM", align: "right" },
            { key: "threePa", header: "3PA", align: "right" },
            {
              key: "plusMinus", header: "+/-", align: "right", render: (r: GameLogEntry) => (
                <span className={r.plusMinus > 0 ? "text-green-700" : r.plusMinus < 0 ? "text-red-600" : ""}>
                  {r.plusMinus > 0 ? "+" : ""}{r.plusMinus}
                </span>
              )
            },
          ]}
          data={displayGameLog}
          emptyMessage="No game log data available"
        />

        {/* Pagination controls — only for premium users */}
        {isPremium && hasMore && (
          <div className="mt-4 flex justify-center border-t border-gray-100 pt-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more games"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
