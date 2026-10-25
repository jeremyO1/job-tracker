import { Link } from "react-router-dom";
import { relativeDay } from "../lib/format";
import { CompanyAvatar, StatusBadge } from "./ui";

export default function AppCard({ app }) {
  return (
    <Link
      to={`/applications/${app.application_id}`}
      className="group block rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-px hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <CompanyAvatar name={app.company} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-slate-900">{app.company}</div>
          <div className="truncate text-sm text-slate-500">{app.job_title}</div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <StatusBadge substate={app.substate} />
        <span className="text-xs text-slate-400 whitespace-nowrap">{relativeDay(app.latest_date)}</span>
      </div>
    </Link>
  );
}
