import { Link, useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { clearParticipant, getParticipantCode } from "@/lib/participant";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/tfs-platform-logo.png";

export interface AppHeaderProps {
  subtitle?: string | undefined;
  code?: string | null | undefined;
  isAdmin?: boolean | undefined;
}

export function AppHeader({ subtitle, code: overrideCode, isAdmin = false }: AppHeaderProps) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (overrideCode !== undefined) {
      setCode(overrideCode);
    } else {
      setCode(getParticipantCode());
    }
  }, [overrideCode]);

  function exit() {
    clearParticipant();
    router.navigate({ to: "/" });
  }

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <Link to={isAdmin ? "/admin" : "/sub-tests"} className="flex items-center gap-3">
          <img src={logoAsset} alt="Logo Taruna Future Scan" className="h-9 w-auto" />
          <span className="leading-tight">
            <span className="block font-display text-base font-semibold">
              Taruna Future Scanner
            </span>
            {subtitle ? (
              <span className="block text-xs text-muted-foreground">{subtitle}</span>
            ) : null}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {code ? (
            <span className="hidden rounded-md bg-muted px-2.5 py-1 font-display text-xs font-semibold tracking-wide sm:inline">
              {code}
            </span>
          ) : null}
          {isAdmin ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/admin">Kembali ke Admin</Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={exit}>
              <LogOut className="mr-2 size-4" /> Keluar
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
