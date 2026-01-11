import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
}

export function AppHeader({ title = "Dashboard", subtitle }: AppHeaderProps) {
  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex flex-col justify-center">
        <h1 className="text-base font-semibold text-foreground leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-medium text-sm">A</span>
          </div>
          <span className="text-sm font-medium text-foreground">Administrador</span>
        </div>
      </div>
    </header>
  );
}
