import { Router, type Request, type Response } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  getRecentAdminAudit,
  recordAdminAudit,
  type AdminAuditAction,
} from "../services/adminAuditService.js";

const router = Router();
const adminAddress = process.env.VAULT_ADMIN_ADDRESS;
let pausedState = process.env.VAULT_PAUSED === "true";
let currentWasmHash = process.env.VAULT_WASM_HASH ?? null;
const requiredSigners = Math.max(
  1,
  Number.parseInt(process.env.GOVERNANCE_REQUIRED_SIGNERS ?? "1", 10) || 1,
);

function requireVaultAdmin(req: Request, res: Response): string | null {
  const actor = (req as any).user?.sub as string | undefined;
  if (!adminAddress || !actor || actor !== adminAddress) {
    res.status(403).json({ error: "Vault admin access required" });
    return null;
  }
  return actor;
}

router.use(authenticate);

router.get("/status", (req, res) => {
  const actor = requireVaultAdmin(req, res);
  if (!actor) return;

  res.json({
    isAdmin: true,
    adminAddress,
    paused: pausedState,
    wasmHash: currentWasmHash,
    requiredSigners,
    governanceRequired: requiredSigners > 1,
  });
});

router.get("/audit", (req, res) => {
  if (!requireVaultAdmin(req, res)) return;
  res.json({ entries: getRecentAdminAudit() });
});

router.post("/actions", (req, res) => {
  const actor = requireVaultAdmin(req, res);
  if (!actor) return;

  const action = req.body?.action as AdminAuditAction;
  const wasmHash = req.body?.wasmHash as string | undefined;
  if (!["pause", "unpause", "upgrade"].includes(action)) {
    res.status(400).json({ error: "Action must be pause, unpause, or upgrade" });
    return;
  }
  if (action === "upgrade" && !/^[0-9a-fA-F]{64}$/.test(wasmHash ?? "")) {
    res.status(400).json({ error: "Upgrade requires a 32-byte Wasm hash" });
    return;
  }

  const status = requiredSigners > 1 ? "pending_signatures" : "submitted";
  const transactionId = crypto.randomUUID();
  const audit = await recordAdminAudit({
    action,
    actor,
    status,
    transactionId,
    ...(wasmHash ? { wasmHash } : {}),
  });
  if (status === "submitted" && action !== "upgrade") pausedState = action === "pause";
  if (status === "submitted" && action === "upgrade") currentWasmHash = wasmHash ?? currentWasmHash;

  res.status(202).json({
    transactionId,
    audit,
    status,
    requiredSigners,
    contractMethod: action,
    contractArguments: action === "upgrade" ? { newWasmHash: wasmHash } : { admin: actor },
    requiresMultiSig: requiredSigners > 1,
    message: status === "pending_signatures"
      ? `Governance approval required: ${requiredSigners} signatures.`
      : "Transaction intent submitted for wallet signing.",
  });
});

export { router as adminRouter };
