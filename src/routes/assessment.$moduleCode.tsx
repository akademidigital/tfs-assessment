import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { getModule, submitBatchAnswers } from "@/lib/assessment.functions";
import { useParticipantId } from "@/hooks/use-participant";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LoadingScreen } from "@/components/loading-screen";
import { cn } from "@/lib/utils";

const OPTIONS = [1, 2, 3, 4, 5];

export const Route = createFileRoute("/assessment/$moduleCode")({
  head: ({ params }) => {
    const title = `Sub-Tes ${params.moduleCode} — Taruna Future Scanner`;
    const description = `Kerjakan sub-tes ${params.moduleCode}. Jawaban tersimpan otomatis dan dapat dilanjutkan kapan saja.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: AssessmentPage,
});

type SaveState = "idle" | "saving" | "saved" | "error";

function AssessmentPage() {
  const { moduleCode } = Route.useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const participantId = useParticipantId();
  const fetchModule = useServerFn(getModule);
  const saveBatch = useServerFn(submitBatchAnswers);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["module", moduleCode, participantId],
    queryFn: () => fetchModule({ data: { moduleCode, participantId: participantId! } }),
    enabled: Boolean(participantId),
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const storageKey = participantId ? `tfs_answers_${participantId}_${moduleCode}` : null;
  const dirtyRef = useRef(false);
  const isSavingRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  // 1. Initial Load: Merge server answers with local storage cache
  useEffect(() => {
    if (!data) return;
    let merged = { ...data.answers };
    if (typeof window !== "undefined" && storageKey) {
      try {
        const local = localStorage.getItem(storageKey);
        if (local) {
          const parsed = JSON.parse(local) as Record<string, number>;
          merged = { ...merged, ...parsed };
        }
      } catch {
        // ignore parse error
      }
    }
    setAnswers(merged);
    const firstUnanswered = data.questions.findIndex((q) => !(q.id in merged));
    setIndex(firstUnanswered === -1 ? Math.max(data.questions.length - 1, 0) : firstUnanswered);
  }, [data, storageKey]);

  // 2. Periodic background batch sync (every 6 seconds if answers changed)
  useEffect(() => {
    if (!participantId || !data) return;
    const interval = setInterval(async () => {
      if (
        dirtyRef.current &&
        !isSubmittingRef.current &&
        !isSavingRef.current &&
        Object.keys(answersRef.current).length > 0
      ) {
        isSavingRef.current = true;
        dirtyRef.current = false;
        try {
          await saveBatch({
            data: {
              participantId,
              moduleCode,
              answers: answersRef.current,
              markCompleted: false,
            },
          });
          setSaveState("saved");
        } catch {
          dirtyRef.current = true;
          setSaveState("error");
        } finally {
          isSavingRef.current = false;
        }
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [participantId, moduleCode, data, saveBatch]);

  const total = data?.questions.length ?? 0;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const question = data?.questions[index];
  const needsDisclaimer = Boolean(data?.module.isSensitive) && !acknowledged && answeredCount === 0;

  async function finalizeModule(allAnswers: Record<string, number>) {
    if (!participantId || isSubmitting) return;
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    setSaveState("saving");

    // Wait briefly if an autosave is currently in flight to prevent concurrency clash
    let attempts = 0;
    while (isSavingRef.current && attempts < 15) {
      await new Promise((r) => setTimeout(r, 100));
      attempts += 1;
    }

    try {
      await saveBatch({
        data: {
          participantId,
          moduleCode,
          answers: allAnswers,
          markCompleted: true,
        },
      });
      if (typeof window !== "undefined" && storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {
          // ignore
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["module-result"] }),
      ]);
      router.navigate({ to: "/result/$moduleCode", params: { moduleCode } });
    } catch (err) {
      console.error("Gagal mengirim hasil sub-tes:", err);
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      setSaveState("error");
    }
  }

  function choose(value: number) {
    if (!question || isSubmitting) return;
    const questionId = question.id;
    const nextAnswers = { ...answers, [questionId]: value };

    // 1. Instant optimistic state update (0ms latency)
    setAnswers(nextAnswers);
    dirtyRef.current = true;

    // 2. Instant offline backup to localStorage
    if (typeof window !== "undefined" && storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextAnswers));
      } catch {
        // storage disabled
      }
    }

    // 3. Instant jump to next unanswered question
    const questions = data?.questions ?? [];
    const forward = questions.findIndex((q, i) => i > index && !(q.id in nextAnswers));
    const target = forward !== -1 ? forward : questions.findIndex((q) => !(q.id in nextAnswers));

    if (target !== -1) {
      setIndex(target);
    } else if (Object.keys(nextAnswers).length >= total && total > 0) {
      // All questions answered: Finalize and score synchronously!
      void finalizeModule(nextAnswers);
    }
  }

  const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle={data?.module.name ?? moduleCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            onClick={() => {
              if (
                dirtyRef.current &&
                participantId &&
                !isSubmittingRef.current &&
                Object.keys(answersRef.current).length > 0
              ) {
                dirtyRef.current = false;
                void saveBatch({
                  data: {
                    participantId,
                    moduleCode,
                    answers: answersRef.current,
                    markCompleted: false,
                  },
                });
              }
            }}
          >
            <Link to="/sub-tests">
              <ArrowLeft className="mr-2 size-4" /> Daftar sub-tes
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            {total > 0 ? `Pertanyaan ${Math.min(index + 1, total)} dari ${total}` : ""}
          </span>
        </div>

        <Progress value={pct} className="mt-4" />

        {saveState === "error" && !isSubmitting && (
          <div className="mt-3 flex h-5 items-center gap-2 text-xs text-destructive">
            <span>Gagal menyimpan.</span>
            <button
              className="inline-flex items-center gap-1 underline"
              onClick={() => void finalizeModule(answers)}
            >
              <RefreshCw className="size-3" /> Coba lagi
            </button>
          </div>
        )}

        {isSubmitting ? (
          <LoadingScreen
            label="Menyimpan dan menghitung skor..."
            hint="Sedang merangkum hasil sub-tes Anda."
          />
        ) : isPending ? (
          <LoadingScreen
            label="Memuat pertanyaan..."
            hint="Menyiapkan sub-tes dan jawaban tersimpan."
          />
        ) : error ? (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p>Gagal memuat sub-tes.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Muat ulang
            </Button>
          </div>
        ) : needsDisclaimer ? (
          <Card className="mt-6 border-warning/50 bg-warning/10">
            <CardContent className="pt-6">
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="size-3" /> Sub-tes sensitif
              </Badge>
              <h1 className="mt-4 text-xl font-semibold">{data?.module.name}</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                Sub-tes ini menanyakan kondisi kesejahteraan psikologis Anda. Tidak ada jawaban
                benar atau salah, dan hasilnya <strong>bukan diagnosis medis</strong>. Jawablah
                sejujur mungkin sesuai kondisi Anda belakangan ini.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Jika Anda merasa tertekan saat mengerjakan, Anda dapat berhenti dan menghubungi
                kontak dukungan yang tercantum di laporan.
              </p>
              <Button className="mt-5" onClick={() => setAcknowledged(true)}>
                Saya mengerti, lanjutkan
              </Button>
            </CardContent>
          </Card>
        ) : question ? (
          <>
            <h1 className="sr-only">
              Pertanyaan Sub-Tes {moduleCode} — {data?.module.name}
            </h1>
            <Card className="mt-6 border-border/70">
              <CardContent className="py-10 text-center">
                <Badge variant="secondary">{data?.module.code}</Badge>
                <p className="mx-auto mt-5 max-w-xl font-display text-lg font-semibold leading-relaxed md:text-xl">
                  {question.text}
                </p>
              </CardContent>
            </Card>

            <div className="mt-6">
              <div className="flex items-center justify-center gap-3 md:gap-5">
                {OPTIONS.map((value) => {
                  const selected = answers[question.id] === value;
                  return (
                    <button
                      key={value}
                      onClick={() => choose(value)}
                      aria-label={`Pilih ${value}`}
                      className={cn(
                        "flex size-12 items-center justify-center rounded-full border-2 font-display text-base font-bold transition-all disabled:opacity-60 md:size-14 md:text-lg",
                        selected
                          ? "border-primary bg-primary text-primary-foreground scale-105"
                          : "border-border bg-card text-foreground hover:border-primary hover:text-primary",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Sangat Tidak Setuju</span>
                <span>Sangat Setuju</span>
              </div>
            </div>

            <div className="mt-6 flex justify-between text-xs text-muted-foreground">
              <button
                className="underline disabled:opacity-40"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              >
                Pernyataan sebelumnya
              </button>
              <span>Layar berpindah otomatis ke butir berikutnya.</span>
            </div>

            {total > 0 && answeredCount < total && index === total - 1 ? (
              <div className="mt-6 rounded-lg border border-warning/50 bg-warning/10 p-4 text-sm">
                <p>
                  Masih ada {total - answeredCount} pernyataan yang belum dijawab pada sub-tes ini.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    const idx = (data?.questions ?? []).findIndex((q) => !(q.id in answers));
                    if (idx !== -1) setIndex(idx);
                  }}
                >
                  Lanjut ke pernyataan yang belum dijawab
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
