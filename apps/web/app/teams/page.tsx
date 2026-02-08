"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { getTeams } from "@/lib/api";
import type { TeamSummary } from "@/lib/types";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getTeams();
      setTeams(data);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <PageHeader title="Teams" subtitle="All 30 NBA teams with season records and ratings" />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <DataTable
          columns={[
            { key: "name", header: "Team", sortable: true, render: (r: TeamSummary) => (
              <div>
                <span className="font-medium text-gray-900">{r.name}</span>
                <span className="ml-2 text-xs text-gray-400">{r.abbreviation}</span>
              </div>
            )},
            { key: "wins", header: "W", align: "right", sortable: true },
            { key: "losses", header: "L", align: "right", sortable: true },
            { key: "offRating", header: "ORtg", align: "right", sortable: true, render: (r: TeamSummary) => r.offRating.toFixed(1) },
            { key: "defRating", header: "DRtg", align: "right", sortable: true, render: (r: TeamSummary) => r.defRating.toFixed(1) },
            { key: "netRating", header: "Net Rtg", align: "right", sortable: true, render: (r: TeamSummary) => (
              <span className={r.netRating > 0 ? "font-semibold text-green-700" : r.netRating < 0 ? "text-red-600" : ""}>
                {r.netRating > 0 ? "+" : ""}{r.netRating.toFixed(1)}
              </span>
            )},
          ]}
          data={teams}
          isLoading={loading}
          onRowClick={(row) => router.push(`/teams/${row.teamId}`)}
        />
      </div>
    </div>
  );
}
