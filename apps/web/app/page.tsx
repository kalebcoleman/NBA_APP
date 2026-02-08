"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/Card";
import StatCard from "@/components/StatCard";
import BarChartWrapper from "@/components/BarChartWrapper";
import { getPlayers, getTeams } from "@/lib/api";
import type { PlayerSummary, TeamSummary } from "@/lib/types";

export default function HomePage() {
  const [topPlayers, setTopPlayers] = useState<PlayerSummary[]>([]);
  const [topTeams, setTopTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [playersRes, teams] = await Promise.all([
        getPlayers({ limit: 5 }),
        getTeams(),
      ]);
      setTopPlayers(playersRes.data.slice(0, 5));
      setTopTeams(teams.sort((a, b) => b.netRating - a.netRating).slice(0, 5));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-nba-blue to-nba-blue/80 p-8 text-white sm:p-12">
        <h1 className="text-3xl font-extrabold sm:text-4xl">NBA Analytics Platform</h1>
        <p className="mt-2 max-w-xl text-lg text-white/80">
          AI-powered stats, interactive shot charts, and advanced metrics. Ask any question about NBA data.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/qa" className="btn-gold">
            Ask a Question
          </Link>
          <Link href="/players" className="inline-flex items-center rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/30">
            Browse Players
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Players Tracked" value="530+" subtitle="Current season" />
        <StatCard label="Shot Records" value="2.5M+" subtitle="Multi-season data" />
        <StatCard label="Games" value="14,900+" subtitle="Historical coverage" />
        <StatCard label="Advanced Metrics" value="20+" subtitle="xFG, SDI, POE & more" />
      </div>

      {/* Scoring Leaders & Top Teams */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Scoring Leaders">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <>
              <BarChartWrapper
                data={topPlayers.map((p) => ({ name: p.name.split(" ").pop(), ppg: p.ppg }))}
                xKey="name"
                yKey="ppg"
                color="#c8102e"
                height={220}
              />
              <div className="mt-3 text-right">
                <Link href="/leaderboards" className="text-sm font-medium text-nba-blue hover:underline">
                  View full leaderboard →
                </Link>
              </div>
            </>
          )}
        </Card>

        <Card title="Top Teams by Net Rating">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : (
            <>
              <BarChartWrapper
                data={topTeams.map((t) => ({ name: t.abbreviation, netRating: t.netRating }))}
                xKey="name"
                yKey="netRating"
                color="#1d428a"
                height={220}
              />
              <div className="mt-3 text-right">
                <Link href="/teams" className="text-sm font-medium text-nba-blue hover:underline">
                  View all teams →
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Feature Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/qa" className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-nba-blue/30 hover:shadow-md">
          <div className="text-2xl">💬</div>
          <h3 className="mt-2 font-bold text-gray-900 group-hover:text-nba-blue">AI Q&A</h3>
          <p className="mt-1 text-sm text-gray-500">Ask any NBA stats question in plain English</p>
        </Link>
        <Link href="/compare" className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-nba-blue/30 hover:shadow-md">
          <div className="text-2xl">📊</div>
          <h3 className="mt-2 font-bold text-gray-900 group-hover:text-nba-blue">Compare Players</h3>
          <p className="mt-1 text-sm text-gray-500">Head-to-head stats with interactive charts</p>
        </Link>
        <Link href="/players" className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:border-nba-blue/30 hover:shadow-md">
          <div className="text-2xl">🎯</div>
          <h3 className="mt-2 font-bold text-gray-900 group-hover:text-nba-blue">Shot Charts</h3>
          <p className="mt-1 text-sm text-gray-500">Interactive court visualizations with 2.5M+ shots</p>
        </Link>
      </div>
    </div>
  );
}
