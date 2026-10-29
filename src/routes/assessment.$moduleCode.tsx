import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CloudUpload, Loader2, RefreshCw } from "lucide-react";
import { getModule, submitAnswer } from "@/lib/assessment.functions";
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
  const participantId = useParticipantId();
  const fetchModule = useServerFn(getModule);
  const save = useServerFn(submitAnswer);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["module", moduleCode, participantId],
    queryFn: () => fetchModule({ data: { moduleCode, participantId: participantId! } }),
    enabled: Boolean(participantId),
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pending, setPending] = useState<{ questionId: string; value: number } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!data) return;
    setAnswers(data.answers);
    const firstUnanswered = data.questions.findIndex((q) => !(q.id in data.answers));
    setIndex(firstUnanswered === -1 ? Math.max(data.questions.length - 1, 0) : firstUnanswered);
  }, [data]);

  const total = data?.questions.length ?? 0;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const question = data?.questions[index];
  const needsDisclaimer = Boolean(data?.module.isSensitive) && !acknowledged && answeredCount === 0;

  async function commit(questionId: string, value: number, isLastItem = false) {
    if (!participantId) return;
    setSaveState("saving");
    setPending({ questionId, value });
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const res = await save({ data: { questionId, value, participantId } });
        setSaveState("saved");
        setPending(null);
        if (res.moduleCompleted || isLastItem) {
          router.navigate({ to: "/result/$moduleCode", params: { moduleCode } });
          return;
        }
        return;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      }
    }
    console.error(lastError);
    setSaveState("error");
  }

  function choose(value: number) {
    if (!question) return;
    const questionId = question.id;
    const nextAnswers = { ...answers, [questionId]: value };

    // 1. Instant optimistic state update (0ms UI latency)
    setAnswers(nextAnswers);

    // 2. Instant jump to next unanswered question
    const questions = data?.questions ?? [];
    const forward = questions.findIndex((q, i) => i > index && !(q.id in nextAnswers));
    const target = forward !== -1 ? forward : questions.findIndex((q) => !(q.id in nextAnswers));

    const isLastItem = target === -1 && Object.keys(nextAnswers).length >= total;

    if (target !== -1) {
      setIndex(target);
    }

    // 3. Save to server in background
    void commit(questionId, value, isLastItem);
  }

  const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle={data?.module.name ?? moduleCode} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/sub-tests">
              <ArrowLeft className="mr-2 size-4" /> Daftar sub-tes
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            {total > 0 ? `Pertanyaan ${Math.min(index + 1, total)} dari ${total}` : ""}
          </span>
        </div>

        <Progress value={pct} className="mt-4" />

        <div className="mt-3 flex h-5 items-center gap-2 text-xs">
          {saveState === "saving" ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Menyimpan…
            </span>
          ) : saveState === "saved" ? (
            <span className="flex items-center gap-1 text-success">
              <CloudUpload className="size-3" /> Tersimpan
            </span>
          ) : saveState === "error" ? (
            <span className="flex items-center gap-2 text-destructive">
              Gagal menyimpan.
              <button
                className="inline-flex items-center gap-1 underline"
                onClick={() => pending && commit(pending.questionId, pending.value, false)}
              >
                <RefreshCw className="size-3" /> Coba lagi
              </button>
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p>Gagal memuat sub-tes.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
              Muat ulang
            </Button>
          </div>
        ) : null}

        {isPending ? (
          <LoadingScreen
            label="Memuat pertanyaan..."
            hint="Menyiapkan sub-tes dan jawaban tersimpan."
          />
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
              <span>Layar berpindah otomatis setelah jawaban tersimpan.</span>
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
