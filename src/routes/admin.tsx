import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Users,
  CheckCircle2,
  Clock,
  Award,
  Search,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  RefreshCw,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Building2,
  Phone,
  Calendar,
  ShieldCheck,
  BarChart3,
  X,
} from "lucide-react";
import { getAdminReportsFn, getReport, adminLoginFn } from "@/lib/assessment.functions";
import type { AdminStudentItem } from "@/lib/assessment.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import platformLogo from "@/assets/tfs-platform-logo.png";
import brandLogo from "@/assets/powered-by-akademi-taruna.png";

const TITLE = "Panel Admin — Laporan Asesmen Siswa | Taruna Future Scanner";
const DESCRIPTION =
  "Pantau, telusuri, dan unduh laporan hasil asesmen seluruh siswa calon taruna secara menyeluruh.";

interface AdminSearchParams {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  status?: "all" | "completed" | "in_progress" | undefined;
  targetInstitution?: string | undefined;
  sortBy?: "latest" | "oldest" | "name_asc" | undefined;
}

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): AdminSearchParams => {
    const rawPage = Number(search["page"]);
    const rawLimit = Number(search["limit"]);
    const rawSearch = search["search"];
    const rawStatus = search["status"];
    const rawTarget = search["targetInstitution"];
    const rawSortBy = search["sortBy"];

    return {
      page: rawPage > 0 ? rawPage : 1,
      limit: rawLimit > 0 ? rawLimit : 10,
      search: typeof rawSearch === "string" && rawSearch.trim() ? rawSearch.trim() : undefined,
      status:
        rawStatus === "completed" || rawStatus === "in_progress" || rawStatus === "all"
          ? (rawStatus as "all" | "completed" | "in_progress")
          : "all",
      targetInstitution: typeof rawTarget === "string" && rawTarget.trim() ? rawTarget.trim() : undefined,
      sortBy:
        rawSortBy === "oldest" || rawSortBy === "name_asc" || rawSortBy === "latest"
          ? (rawSortBy as "latest" | "oldest" | "name_asc")
          : "latest",
    };
  },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminPage,
});

function getScoreTone(score: number | null | undefined) {
  if (score == null) return { badge: "bg-muted text-muted-foreground", text: "text-muted-foreground" };
  if (score >= 80) return { badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", text: "text-emerald-600" };
  if (score >= 65) return { badge: "bg-sky-500/15 text-sky-600 border-sky-500/30", text: "text-sky-600" };
  if (score >= 50) return { badge: "bg-amber-500/15 text-amber-600 border-amber-500/30", text: "text-amber-600" };
  return { badge: "bg-rose-500/15 text-rose-600 border-rose-500/30", text: "text-rose-600" };
}

function exportToCsv(students: AdminStudentItem[], filename = "laporan-siswa-tfs.csv") {
  const headers = [
    "No",
    "Kode Peserta",
    "Nama Lengkap",
    "Gender",
    "Asal Sekolah",
    "Kelas",
    "Kota",
    "WhatsApp",
    "Email",
    "Target Institusi",
    "Target Program",
    "Status Asesmen",
    "Modul Selesai",
    "Indeks Kesiapan (%)",
    "Kategori Kesiapan",
    "Tanggal Terdaftar",
    "Tanggal Selesai",
  ];

  const rows = students.map((s, idx) => [
    idx + 1,
    s.code || "-",
    `"${(s.fullName || "").replace(/"/g, '""')}"`,
    s.gender || "-",
    `"${(s.schoolName || "").replace(/"/g, '""')}"`,
    s.classLevel || "-",
    `"${(s.city || "").replace(/"/g, '""')}"`,
    s.whatsapp ? `'${s.whatsapp}` : "-",
    s.email || "-",
    `"${(s.targetInstitution || "").replace(/"/g, '""')}"`,
    `"${(s.targetProgram || "").replace(/"/g, '""')}"`,
    s.session?.isCompleted ? "Selesai" : "Sedang Mengerjakan",
    `${s.session?.completedModulesCount ?? 0}/${s.session?.totalModulesCount ?? 9}`,
    s.session?.readinessScore != null ? s.session.readinessScore : "-",
    `"${(s.session?.readinessCategory || "-").replace(/"/g, '""')}"`,
    new Date(s.registeredAt).toLocaleDateString("id-ID"),
    s.session?.completedAt ? new Date(s.session.completedAt).toLocaleDateString("id-ID") : "-",
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function AdminPage() {
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [, startTransition] = useTransition();

  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tfs_admin_token");
    }
    return null;
  });

  const [loginUsername, setLoginUsername] = useState("admin");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

  const loginAdmin = useServerFn(adminLoginFn);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPassword.trim()) {
      toast.error("Masukkan kata sandi admin.");
      return;
    }
    setLoginLoading(true);
    try {
      const res = await loginAdmin({
        data: {
          username: loginUsername.trim(),
          password: loginPassword.trim(),
        },
      });
      if (res.token) {
        localStorage.setItem("tfs_admin_token", res.token);
        setAdminToken(res.token);
        toast.success("Berhasil masuk ke panel administrator.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal masuk. Periksa kembali username dan password.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("tfs_admin_token");
    }
    setAdminToken(null);
    setLoginPassword("");
    toast.info("Anda telah keluar dari panel admin.");
  };

  const [searchInput, setSearchInput] = useState(searchParams.search || "");
  const [selectedStudent, setSelectedStudent] = useState<AdminStudentItem | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchReports = useServerFn(getAdminReportsFn);
  const fetchSingleReport = useServerFn(getReport);

  const { data, isPending, isFetching, refetch, error } = useQuery({
    queryKey: [
      "admin-reports",
      adminToken,
      searchParams.page,
      searchParams.limit,
      searchParams.search,
      searchParams.status,
      searchParams.targetInstitution,
      searchParams.sortBy,
    ],
    queryFn: () =>
      fetchReports({
        data: {
          page: searchParams.page,
          limit: searchParams.limit,
          search: searchParams.search,
          status: searchParams.status,
          targetInstitution: searchParams.targetInstitution,
          sortBy: searchParams.sortBy,
          adminToken: adminToken ?? undefined,
        },
      }),
    enabled: Boolean(adminToken),
  });

  useEffect(() => {
    if (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("Akses ditolak") || msg.includes("login")) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("tfs_admin_token");
        }
        setAdminToken(null);
        toast.error("Sesi admin berakhir. Silakan login kembali.");
      }
    }
  }, [error]);

  const updateSearch = (patch: AdminSearchParams) => {
    startTransition(() => {
      void navigate({
        search: (prev: AdminSearchParams): AdminSearchParams => ({
          page: patch.page !== undefined ? patch.page : 1,
          limit: patch.limit !== undefined ? patch.limit : prev.limit ?? 10,
          search: patch.search !== undefined ? patch.search : prev.search,
          status: patch.status !== undefined ? patch.status : prev.status ?? "all",
          targetInstitution:
            patch.targetInstitution !== undefined ? patch.targetInstitution : prev.targetInstitution,
          sortBy: patch.sortBy !== undefined ? patch.sortBy : prev.sortBy ?? "latest",
        }),
      });
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch({ search: searchInput.trim() || undefined, page: 1 });
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateSearch({ search: undefined, page: 1 });
  };

  const handleDownloadPdf = async (student: AdminStudentItem) => {
    if (downloadingId) return;
    setDownloadingId(student.participantId);
    try {
      toast.info(`Menyiapkan file PDF untuk ${student.fullName}...`);
      const reportPayload = await fetchSingleReport({ data: { participantId: student.participantId } });
      if (!reportPayload || !reportPayload.overall) {
        toast.error("Laporan siswa belum lengkap atau belum selesai dihitung.");
        return;
      }
      const { downloadReportPdf } = await import("@/lib/report-pdf");
      await downloadReportPdf(reportPayload as never);
      toast.success(`PDF ${student.fullName} berhasil diunduh.`);
    } catch (err) {
      console.error("Gagal membuat PDF:", err);
      toast.error("Gagal mengunduh PDF. Pastikan seluruh sub-tes telah diselesaikan.");
    } finally {
      setDownloadingId(null);
    }
  };

  const pagination = data?.pagination ?? {
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const stats = data?.stats ?? {
    totalParticipants: 0,
    totalCompleted: 0,
    totalInProgress: 0,
    averageReadiness: null,
  };

  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;
  const startItem = pagination.totalCount > 0 ? (currentPage - 1) * pagination.limit + 1 : 0;
  const endItem = Math.min(currentPage * pagination.limit, pagination.totalCount);

  // Generate clean pagination page numbers
  const pageNumbers = (() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i += 1) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-card/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={platformLogo} alt="Logo Taruna Future Scanner" className="h-9 w-auto" />
            <div>
              <span className="flex items-center gap-2">
                <span className="font-display text-base font-bold tracking-tight">Taruna Future Scanner</span>
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] uppercase font-semibold tracking-wider">
                  Panel Admin
                </Badge>
              </span>
              <span className="block text-xs text-muted-foreground">Pusat Laporan & Monitoring Asesmen Siswa</span>
            </div>
          </Link>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              className="text-xs"
            >
              <RefreshCw className={cn("mr-1.5 size-3.5", isFetching && "animate-spin")} />
              {isFetching ? "Memuat..." : "Segarkan"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (data?.items?.length) {
                  exportToCsv(data.items, `laporan-tfs-halaman-${currentPage}.csv`);
                  toast.success("Data siswa berhasil diekspor ke format CSV.");
                } else {
                  toast.error("Tidak ada data untuk diekspor.");
                }
              }}
              disabled={!data?.items?.length}
              className="text-xs"
            >
              <FileSpreadsheet className="mr-1.5 size-3.5 text-emerald-600" />
              Ekspor Halaman CSV
            </Button>

            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/">Beranda</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Siswa Terdaftar
              </CardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold tracking-tight">
                {isPending ? <Skeleton className="h-8 w-16" /> : stats.totalParticipants.toLocaleString("id-ID")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Semua siswa yang mendaftar akun</p>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Asesmen Selesai
              </CardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold tracking-tight text-emerald-600">
                {isPending ? <Skeleton className="h-8 w-16" /> : stats.totalCompleted.toLocaleString("id-ID")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Laporan hasil telah rampung & dapat diunduh</p>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sedang Mengerjakan
              </CardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <Clock className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold tracking-tight text-amber-600">
                {isPending ? <Skeleton className="h-8 w-16" /> : stats.totalInProgress.toLocaleString("id-ID")}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Belum menuntaskan seluruh 9 sub-tes</p>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rata-rata Kesiapan
              </CardTitle>
              <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                <Award className="size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="font-display text-2xl font-bold tracking-tight text-primary">
                {isPending ? (
                  <Skeleton className="h-8 w-16" />
                ) : stats.averageReadiness != null ? (
                  `${stats.averageReadiness}%`
                ) : (
                  "—"
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Rerata indeks dari siswa yang telah selesai</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter, Search & Status Tabs */}
        <Card className="border-border/70 shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Status Filter Tabs */}
              <Tabs
                value={searchParams.status || "all"}
                onValueChange={(val) => updateSearch({ status: val as "all" | "completed" | "in_progress", page: 1 })}
                className="w-full lg:w-auto"
              >
                <TabsList className="grid grid-cols-3 w-full sm:w-[380px]">
                  <TabsTrigger value="all" className="text-xs">
                    Semua ({stats.totalParticipants})
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs text-emerald-600 data-[state=active]:text-emerald-700">
                    Selesai ({stats.totalCompleted})
                  </TabsTrigger>
                  <TabsTrigger value="in_progress" className="text-xs text-amber-600 data-[state=active]:text-amber-700">
                    Dalam Proses ({stats.totalInProgress})
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Secondary filters: Target Institution & Per-page */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Target Institution Dropdown */}
                <div className="w-[180px]">
                  <Select
                    value={searchParams.targetInstitution || "all"}
                    onValueChange={(val) =>
                      updateSearch({ targetInstitution: val === "all" ? undefined : val, page: 1 })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Target Lembaga" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Target</SelectItem>
                      {(data?.availableTargets ?? []).map((target) => (
                        <SelectItem key={target} value={target}>
                          {target}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Per Page Dropdown */}
                <div className="w-[120px]">
                  <Select
                    value={String(searchParams.limit || 10)}
                    onValueChange={(val) => updateSearch({ limit: Number(val), page: 1 })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Per Halaman" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Baris</SelectItem>
                      <SelectItem value="25">25 Baris</SelectItem>
                      <SelectItem value="50">50 Baris</SelectItem>
                      <SelectItem value="100">100 Baris</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Cari berdasarkan nama siswa, kode peserta (TFS-XXXX), nomor WhatsApp, asal sekolah, atau kota..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 pr-9 h-10 text-sm"
                />
                {searchInput ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Hapus pencarian"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <Button type="submit" className="h-10 px-5 text-xs font-semibold">
                Cari
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card className="border-border/70 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-[50px] text-center text-xs">No</TableHead>
                  <TableHead className="min-w-[200px] text-xs">Siswa & Kode</TableHead>
                  <TableHead className="min-w-[170px] text-xs">Asal Sekolah & Kota</TableHead>
                  <TableHead className="min-w-[150px] text-xs">Target Pilihan</TableHead>
                  <TableHead className="min-w-[140px] text-xs">Progres Modul</TableHead>
                  <TableHead className="min-w-[160px] text-xs">Kesiapan & Kategori</TableHead>
                  <TableHead className="min-w-[120px] text-xs">Terdaftar</TableHead>
                  <TableHead className="text-right text-xs pr-4">Aksi</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isPending ? (
                  // Skeleton rows
                  Array.from({ length: searchParams.limit || 10 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center"><Skeleton className="h-4 w-5 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28 mb-1" /><Skeleton className="h-3 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24 mb-1" /><Skeleton className="h-3 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 mb-1" /><Skeleton className="h-2 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24 mb-1" /><Skeleton className="h-3 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-3 w-20" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.items?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Users className="size-10 text-muted-foreground/40" />
                        <p className="text-base font-semibold">Tidak ada data siswa ditemukan</p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Coba sesuaikan kata kunci pencarian atau bersihkan filter status dan target lembaga.
                        </p>
                        {(searchParams.search || searchParams.status !== "all" || searchParams.targetInstitution) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchInput("");
                              updateSearch({ search: undefined, status: "all", targetInstitution: undefined, page: 1 });
                            }}
                            className="mt-3 text-xs"
                          >
                            Reset Semua Filter
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.items?.map((student, idx) => {
                    const rowNumber = startItem + idx;
                    const session = student.session;
                    const isDone = Boolean(session?.isCompleted);
                    const completedCount = session?.completedModulesCount ?? 0;
                    const totalCount = session?.totalModulesCount || 9;
                    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                    const tone = getScoreTone(session?.readinessScore);

                    return (
                      <TableRow key={student.participantId} className="hover:bg-muted/30 transition-colors">
                        {/* No */}
                        <TableCell className="text-center font-medium text-xs text-muted-foreground">
                          {rowNumber}
                        </TableCell>

                        {/* Siswa & Kode */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-semibold text-sm leading-tight text-foreground">
                              {student.fullName}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono tracking-wide">
                                {student.code || "—"}
                              </Badge>
                              {student.gender ? (
                                <span className="text-[11px]">({student.gender === "L" ? "L" : "P"})</span>
                              ) : null}
                            </div>
                            {student.whatsapp ? (
                              <a
                                href={`https://wa.me/${student.whatsapp.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary hover:underline"
                              >
                                <Phone className="size-3" />
                                {student.whatsapp}
                              </a>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Asal Sekolah & Kota */}
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <p className="font-medium text-foreground">{student.schoolName || "—"}</p>
                            <p className="text-muted-foreground">
                              {student.classLevel ? `Kelas ${student.classLevel}` : ""}
                              {student.classLevel && student.city ? " · " : ""}
                              {student.city || ""}
                            </p>
                          </div>
                        </TableCell>

                        {/* Target Lembaga */}
                        <TableCell>
                          <div className="text-xs space-y-0.5">
                            <p className="font-medium text-primary">
                              {student.targetInstitution || "—"}
                            </p>
                            <p className="text-muted-foreground truncate max-w-[140px]">
                              {student.targetProgram || "Umum"}
                            </p>
                          </div>
                        </TableCell>

                        {/* Progres Modul */}
                        <TableCell>
                          <div className="space-y-1.5 min-w-[120px]">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-[11px]">
                                {completedCount}/{totalCount} Modul
                              </span>
                              <span className="text-muted-foreground text-[10px]">{progressPct}%</span>
                            </div>
                            <Progress value={progressPct} className="h-1.5" />
                            {isDone ? (
                              <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 text-[10px] px-1.5 py-0">
                                Selesai
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0">
                                Dalam Proses
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Skor Kesiapan & Kategori */}
                        <TableCell>
                          {isDone && session?.readinessScore != null ? (
                            <div className="space-y-1">
                              <div className="flex items-baseline gap-1.5">
                                <span className={cn("font-display text-xl font-bold leading-none", tone.text)}>
                                  {session.readinessScore}%
                                </span>
                              </div>
                              <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0", tone.badge)}>
                                {session.readinessCategory || "Terhitung"}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Belum selesai</span>
                          )}
                        </TableCell>

                        {/* Tanggal Terdaftar */}
                        <TableCell>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>{new Date(student.registeredAt).toLocaleDateString("id-ID")}</p>
                            {session?.completedAt ? (
                              <p className="text-[10px] text-emerald-600">
                                Selesai: {new Date(session.completedAt).toLocaleDateString("id-ID")}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>

                        {/* Aksi */}
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Tombol Detail Popup */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedStudent(student)}
                              title="Lihat Rincian Nilai 9 Sub-tes"
                              className="size-8 text-muted-foreground hover:text-foreground"
                            >
                              <Eye className="size-4" />
                            </Button>

                            {/* Tombol Unduh PDF */}
                            {isDone ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void handleDownloadPdf(student)}
                                disabled={downloadingId === student.participantId}
                                title="Unduh Laporan PDF"
                                className="size-8 text-muted-foreground hover:text-primary"
                              >
                                {downloadingId === student.participantId ? (
                                  <RefreshCw className="size-4 animate-spin text-primary" />
                                ) : (
                                  <Download className="size-4" />
                                )}
                              </Button>
                            ) : null}

                            {/* Tombol Buka Laporan Lengkap */}
                            {isDone ? (
                              <Button asChild size="sm" variant="outline" className="h-8 text-xs font-medium">
                                <Link
                                  to="/report"
                                  search={{ participantId: student.participantId }}
                                  target="_blank"
                                  title="Buka Halaman Laporan Interaktif"
                                >
                                  <ExternalLink className="mr-1.5 size-3.5" /> Laporan
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border px-4 py-3 bg-card sm:px-6">
            <p className="text-xs text-muted-foreground text-center sm:text-left">
              Menampilkan <span className="font-semibold text-foreground">{startItem}</span> –{" "}
              <span className="font-semibold text-foreground">{endItem}</span> dari{" "}
              <span className="font-semibold text-foreground">{pagination.totalCount}</span> peserta
            </p>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5">
              {/* Tombol Halaman Pertama */}
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage <= 1 || isPending}
                onClick={() => updateSearch({ page: 1 })}
                className="size-8"
                title="Halaman Pertama"
              >
                <ChevronsLeft className="size-4" />
              </Button>

              {/* Tombol Sebelumnya */}
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage <= 1 || isPending}
                onClick={() => updateSearch({ page: currentPage - 1 })}
                className="size-8"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="size-4" />
              </Button>

              {/* Page Number Buttons */}
              <div className="flex items-center gap-1">
                {pageNumbers.map((p, pIdx) => {
                  if (p === "...") {
                    return (
                      <span key={`ellipsis-${pIdx}`} className="px-1 text-xs text-muted-foreground select-none">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === currentPage;
                  return (
                    <Button
                      key={p}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateSearch({ page: p })}
                      disabled={isPending}
                      className={cn("size-8 text-xs font-medium p-0", isCurrent && "pointer-events-none font-bold")}
                    >
                      {p}
                    </Button>
                  );
                })}
              </div>

              {/* Tombol Berikutnya */}
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => updateSearch({ page: currentPage + 1 })}
                className="size-8"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="size-4" />
              </Button>

              {/* Tombol Halaman Terakhir */}
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => updateSearch({ page: totalPages })}
                className="size-8"
                title="Halaman Terakhir"
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      </main>

      {/* Student Detail Modal Dialog */}
      <Dialog open={Boolean(selectedStudent)} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        {selectedStudent ? (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-4">
                <Badge variant="outline" className="font-mono text-xs">
                  {selectedStudent.code || "TFS"}
                </Badge>
                {selectedStudent.session?.isCompleted ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15">
                    Asesmen Selesai
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                    Dalam Proses
                  </Badge>
                )}
              </div>
              <DialogTitle className="font-display text-xl mt-2">{selectedStudent.fullName}</DialogTitle>
              <DialogDescription>
                {selectedStudent.schoolName ? `${selectedStudent.schoolName} · ` : ""}
                {selectedStudent.city || "Indonesia"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-2">
              {/* Overall readiness summary */}
              {selectedStudent.session?.isCompleted && selectedStudent.session?.readinessScore != null ? (
                <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Indeks Kesiapan Calon Taruna
                    </p>
                    <p className="mt-1 font-display text-3xl font-bold text-primary">
                      {selectedStudent.session.readinessScore}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Kategori: <span className="font-semibold text-foreground">{selectedStudent.session.readinessCategory}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <Button
                      size="sm"
                      onClick={() => void handleDownloadPdf(selectedStudent)}
                      disabled={downloadingId === selectedStudent.participantId}
                      className="text-xs"
                    >
                      <Download className="mr-1.5 size-3.5" />
                      {downloadingId === selectedStudent.participantId ? "Menyiapkan..." : "Unduh PDF"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Biodata Grid */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Informasi Siswa
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Target Lembaga:</span>
                    <p className="font-semibold text-foreground">{selectedStudent.targetInstitution || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Program:</span>
                    <p className="font-semibold text-foreground">{selectedStudent.targetProgram || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nomor WhatsApp:</span>
                    <p className="font-semibold text-foreground">{selectedStudent.whatsapp || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-semibold text-foreground">{selectedStudent.email || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nama Wali:</span>
                    <p className="font-semibold text-foreground">{selectedStudent.guardianName || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">WhatsApp Wali:</span>
                    <p className="font-semibold text-foreground">{selectedStudent.guardianWhatsapp || "—"}</p>
                  </div>
                </div>
              </div>

              {/* 9 Modules Breakdown */}
              {selectedStudent.session?.moduleBreakdown && selectedStudent.session.moduleBreakdown.length > 0 ? (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                    Rincian Skor 9 Sub-tes
                  </h4>
                  <div className="divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden">
                    {selectedStudent.session.moduleBreakdown.map((mod) => (
                      <div key={mod.code} className="flex items-center justify-between p-3 text-xs bg-card hover:bg-muted/30">
                        <div className="flex items-center gap-2.5">
                          <Badge variant="outline" className="font-mono text-[10px] w-12 justify-center">
                            {mod.code}
                          </Badge>
                          <span className="font-medium text-foreground">{mod.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-display font-bold text-sm text-primary">{mod.score}%</span>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0">
                            {mod.category}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Action buttons */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)} className="text-xs">
                  Tutup
                </Button>
                {selectedStudent.session?.isCompleted ? (
                  <Button asChild size="sm" className="text-xs">
                    <Link to="/report" search={{ participantId: selectedStudent.participantId }} target="_blank">
                      <ExternalLink className="mr-1.5 size-3.5" /> Buka Laporan Lengkap
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
