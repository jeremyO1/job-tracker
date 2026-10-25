import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button } from "./ui";
import GmailNotice, { noticeDismissed } from "./GmailNotice";

const POLL_MS = 1200;

/** Starts a background sync and polls its progress, instead of blocking on one long request. */
export default function SyncButton() {
  const { source, refresh } = useApp();
  const [job, setJob] = useState(null);
  const [open, setOpen] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [checking, setChecking] = useState(false);
  const timer = useRef();
  const navigate = useNavigate();

  useEffect(() => () => clearTimeout(timer.current), []);

  // Pick up a sync that is already running (e.g. after a page reload).
  useEffect(() => {
    if (!source) return;
    source.syncStatus().then((s) => {
      if (s.state === "running") { setJob(s); poll(); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  function poll() {
    timer.current = setTimeout(async () => {
      try {
        const s = await source.syncStatus();
        setJob(s);
        if (s.state === "running") poll();
        else await refresh();
      } catch (e) {
        setJob({ state: "error", step: e.message });
      }
    }, POLL_MS);
  }

  async function start() {
    // Most visitors can't connect Gmail (see GmailNotice), so explain that instead of a failed sync.
    if (!source.demo) {
      setChecking(true);
      const accounts = await source.listAccounts().catch(() => null);
      setChecking(false);
      if (accounts?.length === 0) {
        if (noticeDismissed()) navigate("/settings");
        else setShowNotice(true);
        return;
      }
    }
    setOpen(true);
    try {
      setJob(await source.startSync());
      poll();
    } catch (e) {
      setJob({ state: "error", step: e.message });
    }
  }

  const running = job?.state === "running";

  return (
    <div className="relative">
      {showNotice && <GmailNotice onClose={() => setShowNotice(false)} onContinue={() => navigate("/settings")} />}
      <Button variant="primary" disabled={checking} onClick={running ? () => setOpen((o) => !o) : start}>
        <RefreshCw size={15} className={running || checking ? "animate-spin" : ""} />
        <span className="hidden sm:inline">{running ? "Syncing…" : "Sync Gmail"}</span>
      </Button>

      {open && job && (
        <div className="animate-fade-in absolute right-0 top-12 z-30 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-start gap-2">
            {job.state === "done" && <CheckCircle2 className="text-emerald-600 shrink-0" size={18} />}
            {job.state === "error" && <TriangleAlert className="text-rose-600 shrink-0" size={18} />}
            {running && <RefreshCw className="text-brand-600 animate-spin shrink-0" size={18} />}
            <div className="text-sm">
              <div className="font-medium text-slate-900">
                {job.state === "done" ? "Sync complete" : job.state === "error" ? "Sync failed" : "Syncing your inbox"}
              </div>
              <div className="text-slate-500 mt-0.5">{job.step}</div>
            </div>
          </div>
          {job.scanned !== undefined && (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Scanned", job.scanned], ["Job emails", job.relevant], ["New apps", job.added]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 py-2">
                  <dd className="text-lg font-semibold text-slate-900">{v ?? 0}</dd>
                  <dt className="text-xs text-slate-500">{k}</dt>
                </div>
              ))}
            </dl>
          )}
          {job.errors?.map((e) => <p key={e} className="mt-2 text-xs text-amber-700">{e}</p>)}
          {!running && (
            <button className="mt-3 text-xs text-slate-500 hover:text-slate-800" onClick={() => setOpen(false)}>Dismiss</button>
          )}
        </div>
      )}
    </div>
  );
}
