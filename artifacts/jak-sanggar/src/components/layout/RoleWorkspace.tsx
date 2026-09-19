import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, type LucideIcon } from "lucide-react";
import "./role-workspace.css";

type WorkspaceAction = { href: string; label: string };

export function DashboardWelcome({ title, description, role, primary, secondary, actions }: {
  title: string;
  description: string;
  role: string;
  primary?: WorkspaceAction;
  secondary?: WorkspaceAction;
  actions?: ReactNode;
}) {
  return <header className="rw-welcome">
    <div className="rw-welcome-copy">
      <p className="rw-role">{role}</p>
      <h1>{title}</h1>
      <p className="rw-description">{description}</p>
      {(primary || secondary || actions) && <div className="rw-welcome-actions">
        {primary && <Link href={primary.href} className="rw-primary">{primary.label}</Link>}
        {secondary && <Link href={secondary.href} className="rw-secondary">{secondary.label}</Link>}
        {actions}
      </div>}
    </div>
    <div className="rw-welcome-art" aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}brand/jaksanggar-community-banner-20260920-v1.webp`} alt="" width="1600" height="582" decoding="async" />
    </div>
  </header>;
}

export function DashboardMetrics({ items, label = "Ringkasan akun" }: {
  label?: string;
  items: { label: string; value: ReactNode; href?: string; attention?: boolean }[];
}) {
  return <section className="rw-metrics" aria-label={label}>
    {items.map(item => {
      const content = <><span className="rw-metric-label">{item.label}</span><strong>{item.value}</strong>{item.href && <ChevronRight aria-hidden="true" />}</>;
      const className = `rw-metric${item.attention ? " rw-metric-attention" : ""}`;
      return item.href ? <Link href={item.href} className={className} key={item.label}>{content}</Link> : <div className={className} key={item.label}>{content}</div>;
    })}
  </section>;
}

export function DashboardLinks({ title = "Akses cepat", items }: {
  title?: string;
  items: { href: string; label: string; description: string; icon: LucideIcon }[];
}) {
  return <section className="rw-panel">
    <h2>{title}</h2>
    <nav className="rw-action-list" aria-label={title}>
      {items.map(({ href, label, description, icon: Icon }) => <Link href={href} key={href}>
        <span className="rw-action-icon"><Icon aria-hidden="true" /></span>
        <span className="rw-action-copy"><strong>{label}</strong><span>{description}</span></span>
        <ChevronRight className="rw-action-chevron" aria-hidden="true" />
      </Link>)}
    </nav>
  </section>;
}
