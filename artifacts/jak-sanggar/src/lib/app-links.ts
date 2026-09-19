const configuredConsoleUrl = import.meta.env.VITE_CONSOLE_URL?.trim();

/** URL Konsol Kurator yang sepasang dengan mode/port aplikasi saat ini. */
export const consoleUrl = configuredConsoleUrl || "/konsol/";
