import type { RequestHandler } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function createRateLimit(options: {
  name: string;
  windowMs: number;
  max: number;
}): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    const address = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.name}:${address}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, options.max - bucket.count)),
    );

    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res
        .status(429)
        .json({ error: "Terlalu banyak percobaan. Coba lagi nanti." });
      return;
    }

    // Bersihkan bucket kedaluwarsa secara ringan tanpa timer global.
    if (buckets.size > 5_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    next();
  };
}

export function clearRateLimitBucketsForTests(): void {
  buckets.clear();
}
