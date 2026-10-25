import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Inbox } from "lucide-react";
import { useApp } from "../context/AppContext";
import { STAGES, SUBSTATE_PRIORITY, isArchived } from "../lib/stages";
import AppCard from "../components/AppCard";
import { EmptyState, PageHeader } from "../components/ui";

const FILTERS = [
  { key: "all", label: "All active" },
  { key: "action", label: "Needs action", test: (a) => ["action_required", "awaiting_response", "deadline"].includes(a.substate) },
  { key: "scheduled", label: "Scheduled", test: (a) => a.substate === "upcoming" },
];

function byPriority(a, b) {
  const p = SUBSTATE_PRIORITY.indexOf(a.substate) - SUBSTATE_PRIORITY.indexOf(b.substate);
  return p || String(b.latest_date).localeCompare(String(a.latest_date));
}

export default function Dashboard() {
  const { applications, loading, error } = useApp();
  const [filter, setFilter] = useState("all");

  const stats = useMemo(() => {
    const active = applications.filter((a) => !isArchived(a));
    const responded = applications.filter((a) => a.substate !== "applied").length;
    return [
      { label: "Active applications", value: active.length },
      { label: "Interviews", value: active.filter((a) => a.stage === "interview").length },
      { label: "Needs your action", value: active.filter(FILTERS[1].test).length },
      { label: "Offers", value: applications.filter((a) => a.substate === "accepted").length },
      { label: "Response rate", value: applications.length ? `${Math.round((responded / applications.length) * 100)}%` : "–" },
    ];
  }, [applications]);

  const columns = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter).test;
    return STAGES.map((stage) => {
      const inStage = applications.filter((a) => a.stage === stage.key);
      return {
        ...stage,
        active: inStage.filter((a) => !isArchived(a) && (!test || test(a))).sort(byPriority),
        archived: test ? [] : inStage.filter(isArchived).sort(byPriority),
      };
    });
  }, [applications, filter]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Applications" subtitle="Updated automatically from your inbox." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-2xl font-semibold text-slate-900">{loading ? "·" : s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${filter === f.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">Couldn't load applications: {error}</p>}

      {!loading && applications.length === 0 ? (
        <EmptyState icon={Inbox} title="No applications yet">
          Connect Gmail in <Link className="text-brand-700 underline" to="/settings">Settings</Link>, then press <b>Sync Gmail</b>.
        </EmptyState>
      ) : (
        <div className="thin-scroll -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-4">
          {columns.map((col) => <Column key={col.key} col={col} loading={loading} />)}
        </div>
      )}
    </div>
  );
}

function Column({ col, loading }) {
  const [showArchived, setShowArchived] = useState(false);
  return (
    <section className="w-72 shrink-0 md:w-auto">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`size-2 rounded-full ${col.dot}`} />
        <h2 className="text-sm font-semibold text-slate-700">{col.label}</h2>
        <span className="ml-auto rounded-full bg-slate-200/70 px-2 text-xs font-medium text-slate-600">{col.active.length}</span>
      </div>
      <div className="space-y-2.5 rounded-xl bg-slate-100/70 p-2.5 min-h-40">
        {loading && [0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-white/80" />)}
        {!loading && col.active.map((a) => <AppCard key={a.application_id} app={a} />)}
        {!loading && col.active.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Nothing here</p>}
        {!loading && col.archived.length > 0 && (
          <>
            <button onClick={() => setShowArchived((s) => !s)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200/60">
              Rejected & older than 60 days ({col.archived.length})
              <ChevronDown size={14} className={`transition ${showArchived ? "rotate-180" : ""}`} />
            </button>
            {showArchived && <div className="space-y-2.5 opacity-75">{col.archived.map((a) => <AppCard key={a.application_id} app={a} />)}</div>}
          </>
        )}
      </div>
    </section>
  );
}
