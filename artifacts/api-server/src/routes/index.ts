import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import membersRouter from "./members";
import uploadsRouter from "./uploads";
import settingsRouter from "./settings";
import dokumenArsipRouter from "./dokumen-arsip";
import absensiLatihanRouter from "./absensi-latihan";
import kurasiRouter from "./kurasi";
import syncRouter from "./sync";
import publicContentRouter from "./public-content";
import activityAuditRouter from "./activity-audit";
import communicationsRouter from "./communications";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicContentRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(membersRouter);
router.use(uploadsRouter);
router.use(settingsRouter);
router.use(dokumenArsipRouter);
router.use(absensiLatihanRouter);
router.use(kurasiRouter);
router.use(activityAuditRouter);
router.use(communicationsRouter);
router.use(syncRouter);

export default router;
