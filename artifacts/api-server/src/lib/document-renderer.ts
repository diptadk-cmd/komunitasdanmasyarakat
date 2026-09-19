/** Production resolves the container service; local development uses loopback. */
export function documentRendererUrl(env: Record<string, string | undefined> = process.env): string {
  return env.DOCUMENT_RENDERER_URL?.trim() ||
    (env.NODE_ENV === "production" ? "http://renderer:3001/render" : "http://127.0.0.1:3001/render");
}
