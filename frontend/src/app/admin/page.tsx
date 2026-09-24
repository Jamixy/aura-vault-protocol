"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Upload, ShieldCheck } from "lucide-react";

interface AdminStatus {
  adminAddress: string;
  paused: boolean;
  wasmHash: string | null;
  requiredSigners: number;
  governanceRequired: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  status: string;
  transactionId: string;
  createdAt: string;
}

const walletStorageKey = "aura_wallet_state";
const clientAdminAddress = process.env.NEXT_PUBLIC_VAULT_ADMIN_ADDRESS;

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("aura_access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(walletStorageKey);
    let address: string | undefined;
    try {
      address = stored ? JSON.parse(stored).address : undefined;
    } catch {
      address = undefined;
    }
    if (!address || (clientAdminAddress && address !== clientAdminAddress)) {
      window.location.replace("/dashboard");
      return;
    }

    void (async () => {
      const response = await fetch("/api/admin/status", { headers: authHeaders() });
      if (!response.ok) {
        window.location.replace("/dashboard");
        return;
      }
      const data = await response.json() as AdminStatus;
      if (data.adminAddress !== address) {
        window.location.replace("/dashboard");
        return;
      }
      setStatus(data);
      const auditResponse = await fetch("/api/admin/audit", { headers: authHeaders() });
      if (auditResponse.ok) setAudit((await auditResponse.json()).entries ?? []);
    })().catch(() => window.location.replace("/dashboard"));
  }, []);

  async function submitAction(action: "pause" | "unpause" | "upgrade", wasmHash?: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ action, wasmHash }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Admin action failed");
      setMessage(data.message);
      setAudit((entries) => [data.audit, ...entries]);
      if (status && data.status === "submitted") {
        setStatus({ ...status, paused: action === "pause", wasmHash: wasmHash ?? status.wasmHash });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin action failed");
    } finally {
      setBusy(false);
    }
  }

  function confirmAction(action: "pause" | "unpause") {
    if (window.confirm(`Confirm vault ${action}? This requires an admin signature.`)) {
      void submitAction(action);
    }
  }

  async function handleUpgrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("wasm") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const hashBuffer = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const wasmHash = Array.from(new Uint8Array(hashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
    void submitAction("upgrade", wasmHash);
  }

  if (!status) return <main className="mx-auto w-full max-w-4xl px-4 py-12">Loading admin controls…</main>;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Restricted control plane</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Vault administration</h1>
          <p className="mt-2 text-sm text-zinc-500">Admin: <span className="font-mono">{status.adminAddress}</span></p>
        </div>
        <ShieldCheck className="text-emerald-600" aria-label="Verified admin" />
      </header>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
      {message && <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" role="status"><CheckCircle2 size={16} />{message}</p>}

      <section className="grid gap-4 sm:grid-cols-2" aria-label="Vault controls">
        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Vault status</p>
          <p className="mt-2 text-2xl font-semibold">{status.paused ? "Paused" : "Active"}</p>
          <div className="mt-5 flex gap-3">
            <button disabled={busy || status.paused} onClick={() => confirmAction("pause")} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Pause vault</button>
            <button disabled={busy || !status.paused} onClick={() => confirmAction("unpause")} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-zinc-600">Unpause vault</button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Current Wasm hash</p>
          <p className="mt-2 break-all font-mono text-sm">{status.wasmHash ?? "Not configured"}</p>
          <form onSubmit={handleUpgrade} className="mt-5 flex items-center gap-3">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600">
              <Upload size={16} /><span className="truncate">Choose Wasm binary</span><input name="wasm" type="file" accept=".wasm,application/wasm" className="sr-only" required />
            </label>
            <button disabled={busy} type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">Upgrade</button>
          </form>
        </div>
      </section>

      {status.governanceRequired && <p className="flex items-center gap-2 text-sm text-amber-700"><AlertTriangle size={16} /> Each action requires {status.requiredSigners} signer approvals.</p>}

      <section>
        <h2 className="text-lg font-semibold">Audit trail</h2>
        <div className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
          {audit.length === 0 ? <p className="p-4 text-sm text-zinc-500">No admin actions recorded.</p> : audit.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-4 p-4 text-sm"><span className="font-medium capitalize">{entry.action}</span><span className="text-zinc-500">{entry.status.replace("_", " ")}</span><time className="text-zinc-400">{new Date(entry.createdAt).toLocaleString()}</time></div>)}
        </div>
      </section>
    </main>
  );
}