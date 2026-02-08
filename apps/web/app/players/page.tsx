"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import SearchInput from "@/components/SearchInput";
import DataTable from "@/components/DataTable";
import { getPlayers } from "@/lib/api";
import type { PlayerSummary } from "@/lib/types"; // used in render callbacks

export default function PlayersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const res = await getPlayers({ search: q || undefined });
    setPlayers(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(search);
  }, [search, load]);

  return (
    <div>
      <PageHeader title="Players" subtitle="Browse all NBA players and their stats" />

      <div className="mb-4 max-w-sm">
        <SearchInput placeholder="Search players..." onSearch={setSearch} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DataTable
          columns={[
            { key: "name", header: "Player", sortable: true, render: (r: PlayerSummary) => <span className="font-medium text-gray-900">{r.name}</span> },
            { key: "team", header: "Team", sortable: true },
            { key: "position", header: "Pos" },
            { key: "ppg", header: "PPG", align: "right", sortable: true },
            { key: "rpg", header: "RPG", align: "right", sortable: true },
            { key: "apg", header: "APG", align: "right", sortable: true },
          ]}
          data={players}
          isLoading={loading}
          emptyMessage="No players found"
          onRowClick={(row) => router.push(`/players/${row.playerId}`)}
        />
      </div>
    </div>
  );
}
