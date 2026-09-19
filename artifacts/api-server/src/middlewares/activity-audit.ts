import type { NextFunction, Request, Response } from "express";
import { recordActivityAudit } from "../lib/activity-audit";
import { logger } from "../lib/logger";

const AUDITED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function matchedRoutePath(req: Request): string {
  const routePath = (req.route as { path?: unknown } | undefined)?.path;
  if (typeof routePath === "string") {
    const base = req.baseUrl.replace(/\/$/, "");
    return `${base}${routePath}`.slice(0, 191);
  }

  // Fallback tetap membuang query string agar token atau parameter lain yang
  // mungkin berada di query tidak pernah masuk log.
  return req.originalUrl.split("?", 1)[0]!.slice(0, 191);
}

/**
 * Audit generik untuk mutasi HTTP terautentikasi. Middleware dipasang sebelum
 * router; `requireAuth` mengisi `req.user` sebelum respons selesai.
 */
export function auditSuccessfulMutation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!AUDITED_METHODS.has(req.method)) {
    next();
    return;
  }

  res.once("finish", () => {
    const actor = req.user;
    if (!actor || res.statusCode < 200 || res.statusCode >= 400) return;

    const path = matchedRoutePath(req);
    // Communication keep-alives and ICE packets are transient transport, not
    // business mutations; their frequency must not flood the permanent audit.
    if (path === "/api/communications/presence" || /\/communications\/calls\/[^/]+\/signals$/.test(path)) return;
    void recordActivityAudit({
      actor,
      action: `http.${req.method.toLowerCase()}`,
      targetType: "http-route",
      targetId: path,
      // Sengaja hanya method + pola route/path. Body, query, header, cookie,
      // token, alamat IP, dan user-agent tidak pernah disalin.
      meta: { method: req.method, path },
    }).catch((error: unknown) => {
      logger.error(
        { err: error, actorId: actor.id, method: req.method, path },
        "Audit mutasi HTTP gagal disimpan",
      );
    });
  });

  next();
}
