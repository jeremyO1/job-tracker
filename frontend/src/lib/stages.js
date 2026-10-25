import { AlarmClock, AlertCircle, CalendarClock, CheckCircle2, Clock, PartyPopper, XCircle } from "lucide-react";

// Board columns, in pipeline order.
export const STAGES = [
  { key: "applied", label: "Applied", dot: "bg-sky-500", ring: "ring-sky-200", text: "text-sky-700" },
  { key: "action_required", label: "Action required", dot: "bg-amber-500", ring: "ring-amber-200", text: "text-amber-700" },
  { key: "assessment", label: "Assessment", dot: "bg-violet-500", ring: "ring-violet-200", text: "text-violet-700" },
  { key: "interview", label: "Interview", dot: "bg-emerald-500", ring: "ring-emerald-200", text: "text-emerald-700" },
];

export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((s) => [s.key, s]));

export const SUBSTATES = {
  applied: { label: "Awaiting response", icon: Clock, cls: "bg-slate-100 text-slate-600" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "bg-slate-100 text-slate-600" },
  action_required: { label: "Your move", icon: AlertCircle, cls: "bg-amber-50 text-amber-700" },
  awaiting_response: { label: "Your move", icon: AlertCircle, cls: "bg-amber-50 text-amber-700" },
  upcoming: { label: "Scheduled", icon: CalendarClock, cls: "bg-emerald-50 text-emerald-700" },
  deadline: { label: "Deadline", icon: AlarmClock, cls: "bg-orange-50 text-orange-700" },
  rejected: { label: "Rejected", icon: XCircle, cls: "bg-rose-50 text-rose-600" },
  accepted: { label: "Offer", icon: PartyPopper, cls: "bg-brand-50 text-brand-700" },
};

// Within a column, the cards that need attention come first.
export const SUBSTATE_PRIORITY = ["upcoming", "deadline", "action_required", "awaiting_response", "accepted", "applied", "completed", "rejected"];

export const STALE_DAYS = 60;

export function isArchived(app) {
  return app.substate === "rejected" || daysSince(app.latest_date) > STALE_DAYS;
}

export function daysSince(date) {
  if (!date) return Infinity;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}
