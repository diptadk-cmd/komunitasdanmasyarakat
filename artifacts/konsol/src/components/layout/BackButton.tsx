import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function BackButton({ to, label = "Kembali" }: { to?: string; label?: string }) {
  const [, navigate] = useLocation();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => (to ? navigate(to) : history.length > 1 ? history.back() : navigate("/"))}
      className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
      data-testid="button-back"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
