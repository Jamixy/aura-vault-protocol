import { logger } from "../logger.js";
import { getWritePool } from "../db.js";

export type AdminAuditAction = "pause" | "unpause" | "upgrade";

export interface AdminAuditEntry {
  id: string;
  action: AdminAuditAction;
  actor: string;
  status: "submitted" | "pending_signatures";
  transactionId: string;
  wasmHash?: string;
  createdAt: string;
}

const recentEntries: AdminAuditEntry[] = [];
const MAX_RECENT_ENTRIES = 100;

export async function recordAdminAudit(entry: Omit<AdminAuditEntry, "id" | "createdAt">): Promise<AdminAuditEntry> {
  const auditEntry: AdminAuditEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  recentEntries.unshift(auditEntry);
  recentEntries.length = Math.min(recentEntries.length, MAX_RECENT_ENTRIES);
  logger.info("Admin action recorded", { audit: auditEntry });

  if (process.env.DATABASE_URL) {
    try {
      await getWritePool().query(
        `INSERT INTO admin_audit_log
          (id, action, actor, status, transaction_id, wasm_hash, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          auditEntry.id,
          auditEntry.action,
          auditEntry.actor,
          auditEntry.status,
          auditEntry.transactionId,
          auditEntry.wasmHash ?? null,
          auditEntry.createdAt,
        ],
      );
    } catch (error) {
      logger.error("Failed to persist admin audit record", { error, audit: auditEntry });
    }
  }
  return auditEntry;
}

export function getRecentAdminAudit(): AdminAuditEntry[] {
  return [...recentEntries];
}
