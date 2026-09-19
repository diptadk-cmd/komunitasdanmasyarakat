import type { ReactNode } from "react";
import { BackButton } from "./BackButton";

export function PageHeader({
  title,
  subtitle,
  actions,
  back = true,
  backTo,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: boolean;
  backTo?: string;
}) {
  return (
    <div className="dashboard-page-header mb-6">
      {back && <BackButton to={backTo} />}
      <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {actions && (
          <div className="flex gap-2 flex-wrap shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
