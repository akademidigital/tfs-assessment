import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/tfs-platform-logo.png";
import brandLogo from "@/assets/powered-by-akademi-taruna.png";

const TITLE = "Taruna Future Scanner — Asesmen Kesiapan Calon Taruna";
const DESCRIPTION =
  "Asesmen psikometrik daring 9 modul dan 313 pernyataan untuk mengukur kesiapan calon taruna AKPOL, AKMIL, dan sekolah kedinasan.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Landing,
});

const paths = [
  {
    img: "https://akademitaruna.com/wp-content/uploads/2025/02/Alex-AKPOL.jpg",
    label: "Taruna AKPOL",
    note: "Akademi Kepolisian",
  },
  {
    img: "https://akademitaruna.com/wp-content/uploads/2025/02/ALFARIZI-MAULANA-BAEHAKI-AKMIL.jpg",
    label: "Taruna AKMIL",
    note: "Akademi Militer",
  },
  {
    img: "https://akademitaruna.com/wp-content/uploads/2025/02/Muhammad-Daffa-Dharmalaksana-KEDINASAN.jpg",
    label: "Sekolah Kedinasan",
    note: "STAN, IPDN, PKN, dll.",
  },
];

function Landing() {
  return (
    <div className="surface-gradient min-h-screen text-primary-foreground">
      <main className="mx-auto flex max-w-4xl flex-col items-center px-4 py-14 text-center md:py-20">
        <img
          src={logoAsset}
          alt="Logo Taruna Future Scan"
          className="h-28 w-auto drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:h-36"
        />

        <h1 className="mt-7 font-display text-3xl font-extrabold uppercase tracking-tight md:text-5xl">
          Taruna Future Scanner — Asesmen Kesiapan Calon Taruna
        </h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.28em] text-primary-foreground/70">
          Asesmen Kesiapan Calon Taruna
        </p>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-primary-foreground/80 md:text-base">
          Ukur kesiapan Anda melalui <strong>9 modul</strong> dan <strong>313 pernyataan</strong>:
          pola pikir taruna, ketangguhan mental, kepemimpinan, kedisiplinan, kesiapan akademik,
          kesiapan fisik, ketahanan tekanan, komitmen jalur karier, dan skrining kesehatan mental.
        </p>

        <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
          {paths.map((p) => (
            <div
              key={p.label}
              className="overflow-hidden rounded-2xl bg-primary-foreground/5 ring-1 ring-primary-foreground/15"
            >
              <img
                src={p.img}
                alt={p.label}
                loading="lazy"
                width={768}
                height={768}
                className="aspect-4/3 w-full object-cover"
              />
              <div className="px-3 py-4">
                <p className="font-display text-sm font-bold uppercase tracking-wide">{p.label}</p>
                <p className="mt-1 text-xs text-primary-foreground/70">{p.note}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to="/daftar">
              Mulai Assessment <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="w-full border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
          >
            <Link to="/cek-hasil">
              <BarChart3 className="mr-2 size-4" /> Cek Hasil Assessment
            </Link>
          </Button>
        </div>

        <p className="mt-6 flex items-center gap-2 text-xs text-primary-foreground/70">
          <Clock className="size-4" /> ± 110 menit · jawaban tersimpan otomatis dan dapat dijeda
        </p>

        <p className="mt-12 flex max-w-xl items-start gap-2 text-left text-xs text-primary-foreground/60">
          <Lock className="mt-0.5 size-4 shrink-0" />
          Hasil asesmen bersifat rahasia, digunakan untuk pembinaan, dan bukan merupakan diagnosis
          medis maupun keputusan seleksi resmi.
        </p>
      </main>

      <footer className="flex flex-col items-center gap-4 border-t border-primary-foreground/15 py-6 text-center text-xs text-primary-foreground/60">
        <img
          src={brandLogo}
          alt="Powered by Akademi Taruna — Lulus Taruna Berprestasi"
          className="h-9 w-auto rounded"
          loading="lazy"
        />
        <span>© {new Date().getFullYear()} Taruna Future Scanner</span>
      </footer>
    </div>
  );
}
