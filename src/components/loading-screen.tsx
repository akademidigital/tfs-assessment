import logoAsset from "@/assets/tfs-platform-logo.png";
import { cn } from "@/lib/utils";

export function LoadingLogo({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      <span className="absolute inset-0 animate-ping rounded-full bg-accent/30" />
      <span className="absolute -inset-2 animate-[spin_2.2s_linear_infinite] rounded-full border-2 border-transparent border-t-accent border-r-accent/40" />
      <img
        src={logoAsset}
        alt="Memuat"
        className="relative size-full animate-[pulse_1.6s_ease-in-out_infinite] rounded-full object-contain"
      />
    </span>
  );
}

export function LoadingScreen({
  label = "Memuat halaman...",
  hint,
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <LoadingLogo className="size-20" />
      <div>
        <p className="font-display text-base font-semibold">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint ?? "Mohon tunggu sebentar."}</p>
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-[slide-in-right_1.2s_ease-in-out_infinite] rounded-full bg-accent" />
      </div>
    </div>
  );
}

export function FullPageLoader(props: { label?: string; hint?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <LoadingScreen {...props} />
    </div>
  );
}
