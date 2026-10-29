import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import platformLogo from "@/assets/tfs-platform-logo.png";
import brandLogo from "@/assets/powered-by-akademi-taruna.png";
import { getDashboard, registerParticipantFn } from "@/lib/assessment.functions";
import { clearParticipant, setParticipant } from "@/lib/participant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TITLE = "Data Peserta Assessment — Taruna Future Scanner";
const DESCRIPTION =
  "Lengkapi data peserta dan persetujuan sebelum memulai asesmen kesiapan taruna.";

export const Route = createFileRoute("/daftar")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Daftar,
});

type FormState = {
  full_name: string;
  gender: string;
  class_level: string;
  school_name: string;
  major: string;
  city: string;
  whatsapp: string;
  email: string;
  birth_place: string;
  birth_date: string;
  height_cm: string;
  weight_kg: string;
  guardian_name: string;
  guardian_whatsapp: string;
  target_institution: string;
  career_target: string;
  referral_source: string;
};

const GENDERS = ["Laki-laki", "Perempuan"];
const CLASSES = ["Kelas 10", "Kelas 11", "Kelas 12", "Lulusan / Alumni"];
const TARGETS = [
  "AKPOL (Akademi Kepolisian)",
  "AKMIL (Akademi Militer)",
  "AAL (Akademi Angkatan Laut)",
  "AAU (Akademi Angkatan Udara)",
  "Sekolah Kedinasan (STAN, IPDN, PKN, dll.)",
  "Belum menentukan",
];
const SOURCES = [
  "Sekolah",
  "Guru / Pembina",
  "Media sosial",
  "Teman / Keluarga",
  "Bimbel",
  "Lainnya",
];

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string | undefined;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={error ? "border-destructive focus-visible:ring-destructive/40" : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Daftar() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const register = useServerFn(registerParticipantFn);
  const fetchDashboard = useServerFn(getDashboard);

  useEffect(() => {
    clearParticipant();
  }, []);

  const [form, setForm] = useState<FormState>({
    full_name: "",
    gender: "",
    class_level: "",
    school_name: "",
    major: "",
    city: "",
    whatsapp: "",
    email: "",
    birth_place: "",
    birth_date: "",
    height_cm: "",
    weight_kg: "",
    guardian_name: "",
    guardian_whatsapp: "",
    target_institution: "",
    career_target: "",
    referral_source: "",
  });
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const set = (key: keyof FormState) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };
  const fullName = form.full_name;
  const email = form.email;

  function validate() {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (form.full_name.trim().length < 2) next.full_name = "Nama lengkap minimal 2 karakter.";
    if (form.height_cm) {
      const h = Number(form.height_cm);
      if (!Number.isInteger(h) || h < 50 || h > 250)
        next.height_cm = "Tinggi badan harus angka bulat antara 50–250 cm.";
    }
    if (form.weight_kg) {
      const w = Number(form.weight_kg);
      if (!Number.isInteger(w) || w < 20 || w > 250)
        next.weight_kg = "Berat badan harus angka bulat antara 20–250 kg.";
    }
    const phone = (v: string) => v.replace(/[^0-9]/g, "");
    if (form.whatsapp && (phone(form.whatsapp).length < 9 || phone(form.whatsapp).length > 15))
      next.whatsapp = "Nomor WhatsApp tidak valid (9–15 angka).";
    if (
      form.guardian_whatsapp &&
      (phone(form.guardian_whatsapp).length < 9 || phone(form.guardian_whatsapp).length > 15)
    )
      next.guardian_whatsapp = "Nomor WA orang tua tidak valid (9–15 angka).";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Format email tidak valid.";
    return next;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      toast.error("Persetujuan diperlukan untuk melanjutkan.");
      return;
    }
    const found = validate();
    setErrors(found);
    const firstKey = Object.keys(found)[0] as keyof FormState | undefined;
    if (firstKey) {
      toast.error(found[firstKey] ?? "Periksa kembali isian Anda.");
      const el = document.getElementById(firstKey);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus();
      return;
    }
    setSaving(true);
    const payload = {
      full_name: fullName,
      gender: form.gender || null,
      class_level: form.class_level || null,
      school_name: form.school_name || null,
      major: form.major || null,
      city: form.city || null,
      whatsapp: form.whatsapp || null,
      email: email || null,
      birth_place: form.birth_place || null,
      birth_date: form.birth_date || null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      guardian_name: form.guardian_name || null,
      guardian_whatsapp: form.guardian_whatsapp || null,
      target_institution: form.target_institution || null,
      career_target: form.career_target || null,
      referral_source: form.referral_source || null,
      consent: true,
    };
    try {
      clearParticipant();
      const created = await register({ data: payload });
      setParticipant(created.participantId, created.code);
      toast.success(`Pendaftaran berhasil. Kode peserta Anda: ${created.code}`, {
        duration: 8000,
      });
      // Prefetch dashboard query into React Query so /sub-tests renders instantly
      await queryClient.prefetchQuery({
        queryKey: ["dashboard", created.participantId],
        queryFn: () => fetchDashboard({ data: { participantId: created.participantId } }),
      });
      router.navigate({ to: "/sub-tests" });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const clean = raw.trim().startsWith("[") || raw.trim().startsWith("{") ? "" : raw;
      toast.error(clean || "Gagal menyimpan data. Periksa kembali isian Anda lalu coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="surface-gradient px-4 py-6 text-primary-foreground">
        <Link to="/" className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <img src={platformLogo} alt="Logo Taruna Future Scan" className="h-10 w-auto" />
            <span className="font-display text-base font-semibold">Taruna Future Scanner</span>
          </span>
          <img src={brandLogo} alt="Powered by Akademi Taruna" className="h-8 w-auto rounded" />
        </Link>
      </div>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Card className="border-border/70">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="size-5" />
              </span>
              <div>
                <h1 className="font-display text-xl">Data Peserta Assessment</h1>
                <CardDescription>
                  Lengkapi data berikut sebelum mengerjakan sembilan modul assessment. Setelah
                  menyimpan, Anda akan mendapat kode peserta untuk membuka hasil kapan saja.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={submit}>
              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  id="full_name"
                  label="Nama Lengkap"
                  required
                  value={fullName}
                  onChange={set("full_name")}
                  error={errors.full_name}
                  placeholder="Nama sesuai identitas"
                />
                <SelectField
                  id="gender"
                  label="Jenis Kelamin"
                  value={form.gender}
                  onChange={set("gender")}
                  options={GENDERS}
                  placeholder="Pilih jenis kelamin"
                />
                <SelectField
                  id="class_level"
                  label="Kelas"
                  value={form.class_level}
                  onChange={set("class_level")}
                  options={CLASSES}
                  placeholder="Pilih kelas"
                />
                <TextField
                  id="school_name"
                  label="Nama Sekolah"
                  value={form.school_name}
                  onChange={set("school_name")}
                />
                <TextField id="major" label="Jurusan" value={form.major} onChange={set("major")} />
                <TextField id="city" label="Kota" value={form.city} onChange={set("city")} />
                <TextField
                  id="whatsapp"
                  label="Nomor WhatsApp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={set("whatsapp")}
                  error={errors.whatsapp}
                  placeholder="08xxxxxxxxxx"
                />
                <TextField
                  id="email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={set("email")}
                  error={errors.email}
                />
                <TextField
                  id="birth_place"
                  label="Tempat Lahir"
                  value={form.birth_place}
                  onChange={set("birth_place")}
                />
                <TextField
                  id="birth_date"
                  label="Tanggal Lahir"
                  type="date"
                  value={form.birth_date}
                  onChange={set("birth_date")}
                />
                <TextField
                  id="height_cm"
                  label="Tinggi Badan (cm)"
                  type="number"
                  value={form.height_cm}
                  onChange={set("height_cm")}
                  error={errors.height_cm}
                />
                <TextField
                  id="weight_kg"
                  label="Berat Badan (kg)"
                  type="number"
                  value={form.weight_kg}
                  onChange={set("weight_kg")}
                  error={errors.weight_kg}
                />
                <TextField
                  id="guardian_name"
                  label="Nama Orang Tua / Wali"
                  value={form.guardian_name}
                  onChange={set("guardian_name")}
                />
                <TextField
                  id="guardian_whatsapp"
                  label="Nomor WA Orang Tua"
                  type="tel"
                  value={form.guardian_whatsapp}
                  onChange={set("guardian_whatsapp")}
                  error={errors.guardian_whatsapp}
                />
                <SelectField
                  id="target_institution"
                  label="Tujuan Kedinasan"
                  value={form.target_institution}
                  onChange={set("target_institution")}
                  options={TARGETS}
                  placeholder="Pilih tujuan kedinasan"
                />
                <TextField
                  id="career_target"
                  label="Target Karier"
                  value={form.career_target}
                  onChange={set("career_target")}
                  placeholder="Contoh: Perwira Polri"
                />
                <div className="md:col-span-2">
                  <SelectField
                    id="referral_source"
                    label="Tahu dari Mana"
                    value={form.referral_source}
                    onChange={set("referral_source")}
                    options={SOURCES}
                    placeholder="Pilih sumber informasi"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/50 p-4">
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                  <span className="text-muted-foreground">
                    Saya menyetujui pengolahan data asesmen ini untuk keperluan pembinaan. Saya
                    memahami bahwa hasil asesmen bukan diagnosis medis maupun keputusan seleksi
                    resmi.
                  </span>
                </label>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan & Mulai Assessment"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
