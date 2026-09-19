// Wouter/regexparam treats a named parameter as one segment, even with "*"
// appended to its name. An optional wildcard handles both root and deep URLs.
export const LEGACY_CONSUMER_ROUTE = "/sewa/*?";
export const LEGACY_CURATOR_ROUTE = "/kurator/*?";
export const LEGACY_PARTNER_ROUTE = "/mitra-pengrajin/*?";

export function legacyConsumerPath(rest: string | undefined): string {
  return rest ? `/konsumen/${rest}` : "/konsumen";
}

export function legacyPartnerPath(rest: string | undefined): string {
  return rest ? `/mitra/${rest}` : "/mitra";
}
