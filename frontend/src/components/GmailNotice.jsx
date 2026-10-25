import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Sparkles, X } from "lucide-react";
import { useApp } from "../context/AppContext";
import { Button, GoogleIcon } from "./ui";

const SKIP_KEY = "vestigo-gmail-notice-seen";

export function noticeDismissed() {
  try { return localStorage.getItem(SKIP_KEY) === "1"; } catch { return false; }
}

/**
 * Explains why most visitors can't connect Gmail: reading email is a Google
 * "restricted" scope, and the app isn't verified, so only approved test users can grant it.
 * `onContinue` is given when the visitor was about to connect, so testers can carry on.
 */
export default function GmailNotice({ onClose, onContinue }) {
  const { enterDemo } = useApp();
  const navigate = useNavigate();
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function proceed() {
    if (dontShow) {
      try { localStorage.setItem(SKIP_KEY, "1"); } catch { /* storage unavailable */ }
    }
    onClose();
    onContinue();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 px-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="gmail-notice-title" onClick={(e) => e.stopPropagation()}
        className="animate-fade-in relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
          <X size={18} />
        </button>
        <div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><ShieldAlert size={20} /></div>
        <h2 id="gmail-notice-title" className="mt-4 text-lg font-semibold text-slate-900">Gmail access is limited for now</h2>
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
          <p>
            Vestigo works by reading your inbox. Google only lets apps that read email be used by the
            public once they have passed its verification process and an annual security audit.
          </p>
          <p>
            Vestigo hasn't been through that yet, so connecting Gmail only works for accounts the
            developer has approved as testers. Anyone else will see a "blocked" message from Google.
          </p>
          <p className="font-medium text-slate-800">
            The demo shows everything Vestigo does, with sample emails and a simulated sync.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button variant="primary" onClick={() => { enterDemo(); onClose(); navigate("/dashboard"); }}>
            <Sparkles size={15} /> Try the demo
          </Button>
          {onContinue && (
            <Button onClick={proceed}><GoogleIcon /> I'm an approved tester, continue</Button>
          )}
        </div>
        {onContinue && (
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} />
            Don't show this again on this device
          </label>
        )}
      </div>
    </div>
  );
}
