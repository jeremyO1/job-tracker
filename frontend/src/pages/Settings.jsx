import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Mail, TriangleAlert } from "lucide-react";
import { useApp } from "../context/AppContext";
import { relativeDay } from "../lib/format";
import { Button, GoogleIcon, PageHeader, Spinner } from "../components/ui";
import GmailNotice, { noticeDismissed } from "../components/GmailNotice";

export default function Settings() {
  const { source, user, demo, signOut } = useApp();
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null); // null | "info" | "connect"
  const [params, setParams] = useSearchParams();
  const gmailResult = params.get("gmail");

  const load = useCallback(() => {
    source?.listAccounts().then(setAccounts).catch((e) => { setAccounts([]); setError(e.message); });
  }, [source]);
  useEffect(load, [load]);

  async function run(action) {
    setError(null);
    try { await action(); } catch (e) { setError(e.message); }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />

      {gmailResult && (
        <div className={`mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${gmailResult === "connected" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
          {gmailResult === "connected" ? <CheckCircle2 size={16} /> : <TriangleAlert size={16} />}
          {gmailResult === "connected" ? `Connected ${params.get("email")}. Press Sync Gmail to import your applications.` : `Couldn't connect Gmail (${params.get("reason")}).`}
          <button className="ml-auto text-xs underline" onClick={() => setParams({})}>Dismiss</button>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Connected inboxes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Vestigo reads these Gmail accounts (read-only) to find application updates. You can connect more than one.
        </p>

        <div className="mt-5 space-y-2">
          {accounts === null && <Spinner className="text-slate-400" />}
          {accounts?.length === 0 && <p className="text-sm text-slate-500">No inbox connected yet.</p>}
          {accounts?.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <Mail size={18} className="text-slate-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-800">{a.email}</div>
                <div className="text-xs text-slate-400">{a.last_synced ? `Last checked ${relativeDay(a.last_synced).toLowerCase()}` : "Never synced"}</div>
              </div>
              <Button variant="ghost" className="text-rose-600" disabled={demo}
                onClick={() => window.confirm(`Disconnect ${a.email}?`) && run(async () => { await source.disconnectAccount(a.id); load(); })}>
                Disconnect
              </Button>
            </div>
          ))}
        </div>

        <Button className="mt-4" disabled={demo}
          onClick={() => (noticeDismissed() ? run(source.connectGmail) : setNotice("connect"))}>
          <GoogleIcon /> Connect a Gmail account
        </Button>
        {demo ? (
          <p className="mt-2 text-xs text-slate-400">Connecting Gmail is disabled in the demo.</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            Gmail access is limited to approved testers until Google verifies the app.{" "}
            <button className="font-medium text-brand-700 hover:underline" onClick={() => setNotice("info")}>Why?</button>
          </p>
        )}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </section>

      {notice && (
        <GmailNotice
          onClose={() => setNotice(null)}
          onContinue={notice === "connect" ? () => run(source.connectGmail) : undefined}
        />
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Account</h2>
        <p className="mt-1 text-sm text-slate-500">{demo ? "You're using the demo account." : `Signed in as ${user?.email}`}</p>
        <Button className="mt-4" variant="danger" onClick={signOut}>{demo ? "Exit demo" : "Sign out"}</Button>
      </section>
    </div>
  );
}
