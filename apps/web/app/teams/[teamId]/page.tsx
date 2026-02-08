"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import DataTable from "@/components/DataTable";
import ErrorState from "@/components/ErrorState";
import Skeleton from "@/components/Skeleton";
import { getTeam } from "@/lib/api";
import type { TeamDetail } from "@/lib/types";

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const router = useRouter();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await getTeam(teamId);
        setTeam(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [teamId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (error || !team) {
    return <ErrorState message="Failed to load team data" onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${team.city} ${team.name}`}
        subtitle={`${team.season} | ${team.record.wins}-${team.record.losses}`}
        actions={
          <Link href="/teams" className="btn-secondary text-sm">
            ← Back to Teams
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="PPG" value={team.stats.ppg.toFixed(1)} />
        <StatCard label="Opp PPG" value={team.stats.oppPpg.toFixed(1)} />
        <StatCard label="ORtg" value={team.stats.offRating.toFixed(1)} />
        <StatCard label="DRtg" value={team.stats.defRating.toFixed(1)} />
        <StatCard label="Pace" value={team.stats.pace.toFixed(1)} />
        <StatCard label="FG%" value={(team.stats.fgPct * 100).toFixed(1) + "%"} />
        <StatCard label="3PT%" value={(team.stats.threePct * 100).toFixed(1) + "%"} />
        <StatCard label="FT%" value={(team.stats.ftPct * 100).toFixed(1) + "%"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Roster">
          <DataTable
            columns={[
              { key: "jerseyNum", header: "#" },
              { key: "name", header: "Player", render: (r: { playerId: string; name: string }) => (
                <Link href={`/players/${r.playerId}`} className="font-medium text-nba-blue hover:underline">
                  {r.name}
                </Link>
              )},
              { key: "position", header: "Pos" },
            ]}
            data={team.roster}
            emptyMessage="No roster data"
          />
        </Card>

        <Card title="Recent Games">
          <DataTable
            columns={[
              { key: "date", header: "Date" },
              { key: "opponent", header: "Opp" },
              { key: "result", header: "Result", render: (r: { result: string }) => (
                <span className={r.result === "W" ? "font-semibold text-green-700" : "text-red-600"}>
                  {r.result}
                </span>
              )},
              { key: "score", header: "Score" },
            ]}
            data={team.recentGames}
            emptyMessage="No game data"
          />
        </Card>
      </div>
    </div>
  );
}
