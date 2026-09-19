const agent = process.env.npm_config_user_agent ?? "";
if (!agent.startsWith("pnpm/")) {
  console.error("Gunakan pnpm melalui Corepack: corepack pnpm install");
  process.exit(1);
}
