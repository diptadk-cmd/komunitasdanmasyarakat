import { Router, type IRouter, type Request, type Response } from "express";
import { activityLogTable, db, usersTable } from "@workspace/db";
import { and, desc, eq, lt } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

function queryString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

router.get(
  "/activity-audit",
  requireAuth,
  requireRole(["admin", "kurator"]),
  async (req: Request, res: Response) => {
    const rawLimit = queryString(req.query["limit"]);
    const parsedLimit = rawLimit === undefined ? 100 : Number(rawLimit);
    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 500
    ) {
      res.status(400).json({ error: "limit harus berupa angka 1 sampai 500." });
      return;
    }

    const action = queryString(req.query["action"]);
    const actorId = queryString(req.query["actorId"]);
    const targetType = queryString(req.query["targetType"]);
    const beforeRaw = queryString(req.query["before"]);
    if (action && action.length > 128) {
      res.status(400).json({ error: "action terlalu panjang." });
      return;
    }
    if (actorId && actorId.length > 36) {
      res.status(400).json({ error: "actorId tidak valid." });
      return;
    }
    if (targetType && targetType.length > 64) {
      res.status(400).json({ error: "targetType tidak valid." });
      return;
    }
    const before = beforeRaw ? new Date(beforeRaw) : undefined;
    if (before && Number.isNaN(before.getTime())) {
      res.status(400).json({ error: "before harus berupa tanggal ISO valid." });
      return;
    }

    const conditions = [
      action ? eq(activityLogTable.action, action) : undefined,
      actorId ? eq(activityLogTable.actorId, actorId) : undefined,
      targetType ? eq(activityLogTable.targetType, targetType) : undefined,
      before ? lt(activityLogTable.createdAt, before) : undefined,
    ].filter((condition) => condition !== undefined);

    const rows = await db
      .select({
        id: activityLogTable.id,
        actorId: activityLogTable.actorId,
        actorRole: activityLogTable.actorRole,
        actorUsername: usersTable.username,
        action: activityLogTable.action,
        targetType: activityLogTable.targetType,
        targetId: activityLogTable.targetId,
        meta: activityLogTable.data,
        createdAt: activityLogTable.createdAt,
      })
      .from(activityLogTable)
      .leftJoin(usersTable, eq(activityLogTable.actorId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activityLogTable.createdAt), desc(activityLogTable.id))
      .limit(parsedLimit);

    const items = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      items,
      nextCursor:
        items.length === parsedLimit
          ? items[items.length - 1]?.createdAt
          : undefined,
    });
  },
);

export default router;
