import { mysqlTable, varchar, index } from "drizzle-orm/mysql-core";
import { idCol, dataCol, createdAtCol, updatedAtCol } from "./_base";

// Log aktivitas
export const activityLogTable = mysqlTable(
  "activity_log",
  {
    id: idCol(),
    actorId: varchar("actor_id", { length: 36 }),
    actorRole: varchar("actor_role", { length: 32 }),
    action: varchar("action", { length: 128 }),
    targetType: varchar("target_type", { length: 64 }),
    targetId: varchar("target_id", { length: 191 }),
    data: dataCol(),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => ({
    byActor: index("idx_activity_log_actor").on(t.actorId),
    byAction: index("idx_activity_log_action").on(t.action),
    byTarget: index("idx_activity_log_target").on(t.targetType, t.targetId),
    byCreatedAt: index("idx_activity_log_created_at").on(t.createdAt),
  }),
);
export type ActivityLog = typeof activityLogTable.$inferSelect;
export type InsertActivityLog = typeof activityLogTable.$inferInsert;
