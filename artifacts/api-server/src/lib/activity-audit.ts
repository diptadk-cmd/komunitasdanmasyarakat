import { activityLogTable, db } from "@workspace/db";
import {
  activityAuditValues,
  type ActivityAuditEvent,
} from "./activity-audit-utils";

export * from "./activity-audit-utils";

export async function recordActivityAudit(
  event: ActivityAuditEvent,
): Promise<void> {
  await db.insert(activityLogTable).values(activityAuditValues(event));
}
