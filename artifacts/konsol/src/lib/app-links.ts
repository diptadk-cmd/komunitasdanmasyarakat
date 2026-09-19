const configuredMainAppUrl = import.meta.env.VITE_MAIN_APP_URL?.trim();
const mainAppBase = (configuredMainAppUrl || "/").replace(/\/?$/, "/");

/** Bentuk URL ke aplikasi utama yang sepasang dengan mode/port konsol ini. */
export function mainAppUrl(path = "/"): string {
  if (path === "/") return mainAppBase;
  return `${mainAppBase}${path.replace(/^\/+/, "")}`;
}

/** Rute beranda peran pada aplikasi utama. */
export function mainAppRolePath(role: string): string {
  if (role === "mitra_pengrajin") return "/mitra";
  if (role === "sewa") return "/konsumen";
  return `/${role}`;
}
