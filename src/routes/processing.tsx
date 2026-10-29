import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { finalize } from "@/lib/assessment.functions";
import { useParticipantId } from "@/hooks/use-participant";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";

const TITLE = "Memproses Hasil — Taruna Future Scanner";
const DESCRIPTION = "Sistem sedang menghitung skor dimensi, sub-tes, dan indeks kesiapan Anda.";

export const Route = createFileRoute("/processing")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Processing,
});

const STEPS = [
  "Memverifikasi kelengkapan jawaban",
  "Menghitung skor tiap dimensi",
  "Menghitung skor sembilan sub-tes",
  "Menyusun indeks kesiapan dan rekomendasi",
];

function Processing() {
  const router = useRouter();
  const participantId = useParticipantId();
  const run = useServerFn(finalize);
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length)), 900);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!participantId) return;
    let cancelled = false;
    (async () => {
      const started = Date.now();
      try {
        const res = await run({ data: { participantId } });
        const wait = Math.max(0, 3800 - (Date.now() - started));
        await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;
        if (res.ready) {
          router.navigate({ to: "/report" });
        } else {
          setMessage("Masih ada sub-tes yang belum selesai. Silakan lengkapi terlebih dahulu.");
        }
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : "Gagal memproses hasil.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, run, participantId]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Memproses hasil asesmen</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Mohon tunggu, jangan menutup halaman ini.
        </p>

        <ul className="mt-10 space-y-4 text-left">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border",
                  i < step ? "border-success bg-success text-success-foreground" : "border-border",
                )}
              >
                {i < step ? (
                  <Check className="size-4" />
                ) : i === step ? (
                  <Loader2 className="size-4 animate-spin text-accent" />
                ) : null}
              </span>
              <span className={i <= step ? "" : "text-muted-foreground"}>{s}</span>
            </li>
          ))}
        </ul>

        {message ? <p className="mt-8 text-sm text-destructive">{message}</p> : null}
      </main>
    </div>
  );
}
