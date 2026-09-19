import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes/index";
import { logger } from "./lib/logger";
import { auditSuccessfulMutation } from "./middlewares/activity-audit";
import { configureTrustedProxy } from "./lib/trusted-proxy";

const app: Express = express();
configureTrustedProxy(app, process.env["TRUST_PROXY_HOPS"]);

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self)",
  );
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS: izinkan eksplisit hanya origin yang dikenal. Karena UI di Replit
// preview & deploy production diproxy ke origin yang sama dengan API
// (lewat shared proxy), permintaan biasanya tanpa Origin header. Origin
// hanya muncul bila ada cross-site call — cabut kalau tidak ada di
// allowlist supaya cookie sesi tidak ikut terbawa ke origin asing.
const allowedOrigins = new Set<string>(
  [
    ...(process.env["ALLOWED_ORIGINS"]?.split(",").map((s) => s.trim()) ?? []),
    ...(process.env["REPLIT_DOMAINS"]
      ?.split(",")
      .map((s) => `https://${s.trim()}`) ?? []),
    process.env["REPLIT_DEV_DOMAIN"]
      ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
      : "",
  ].filter(Boolean),
);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // same-origin / curl
      if (allowedOrigins.size === 0) return cb(null, true); // dev fallback
      if (allowedOrigins.has(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));
app.use(auditSuccessfulMutation);

app.use("/api", router);

export default app;
