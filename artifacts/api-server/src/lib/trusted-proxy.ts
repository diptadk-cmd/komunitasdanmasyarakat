import type { Express } from "express";

/** One trusted hop is intended for the private API behind the Caddy proxy. */
export function configureTrustedProxy(
  app: Express,
  configuredHops: string = "0",
): void {
  if (configuredHops !== "0" && configuredHops !== "1") {
    throw new Error("TRUST_PROXY_HOPS must be either 0 or 1.");
  }
  app.set("trust proxy", configuredHops === "1" ? 1 : false);
}
