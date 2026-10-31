import platformLogo from "@/assets/tfs-platform-logo.png";
import brandLogo from "@/assets/akademi-taruna-landscape-white.png";

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type RGB = [number, number, number];
type Dim = {
  code: string;
  name: string;
  normalized: number;
  moduleName?: string;
  moduleCode?: string;
};
type Mod = {
  code: string;
  name: string;
  normalized: number;
  category: string;
  interpretation?: string | null;
  dimensions: Dim[];
  recommendations: { title: string; body: string }[];
};

export type ReportPdfData = {
  participant: {
    fullName?: string | null;
    targetInstitution?: string | null;
    targetProgram?: string | null;
    city?: string | null;
    code?: string | null;
  };
  overall: { readiness: number; category: string; interpretation?: string | null } | null;
  modules: Mod[];
  strengths: Dim[];
  developmentAreas: Dim[];
  assessmentId: string;
  generatedAt: string;
};

const MARGIN = 40;
const NAVY: RGB = [23, 43, 92];
const NAVY_SOFT: RGB = [46, 106, 200];
const GOLD: RGB = [196, 152, 60];
const GREY: RGB = [110, 116, 128];
const INK: RGB = [28, 32, 40];
const LINE: RGB = [223, 227, 234];
const GREEN: RGB = [34, 150, 94];
const ORANGE: RGB = [214, 138, 32];

const toneColor = (v: number): RGB => (v >= 75 ? GREEN : v >= 50 ? NAVY_SOFT : ORANGE);
const toneTint = (v: number): RGB =>
  v >= 75 ? [236, 248, 241] : v >= 50 ? [237, 243, 253] : [253, 245, 233];
const toneLabel = (v: number) => (v >= 75 ? "Kuat" : v >= 50 ? "Berkembang" : "Perlu Penguatan");

export async function downloadReportPdf(data: ReportPdfData) {
  const [{ jsPDF }, platformImg, brandImg] = await Promise.all([
    import("jspdf"),
    loadImage(platformLogo),
    loadImage(brandLogo),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const FOOTER = 46;
  const bottom = pageH - FOOTER;
  let y = MARGIN;

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const setInk = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const newPage = () => {
    doc.addPage();
    // slim navy ribbon on continuation pages
    setFill(NAVY);
    doc.rect(0, 0, pageW, 34, "F");
    setFill(GOLD);
    doc.rect(0, 34, pageW, 2, "F");
    if (platformImg) {
      try {
        doc.addImage(platformImg, "PNG", MARGIN, 5, 24, 24);
      } catch {
        /* ignore */
      }
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setInk([255, 255, 255]);
    doc.text("Taruna Future Scanner — Laporan Kesiapan", MARGIN + (platformImg ? 32 : 0), 21);
    if (brandImg) {
      try {
        doc.addImage(brandImg, "PNG", pageW - MARGIN - 84, 8, 84, 20);
      } catch {
        /* ignore */
      }
    }
    y = 58;
  };

  const ensure = (needed: number) => {
    if (y + needed > bottom) newPage();
  };

  // ---------- text primitives ----------
  const lines = (value: string, w: number, size: number, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    return doc.splitTextToSize(value, w) as string[];
  };

  const drawText = (
    value: string,
    x: number,
    ty: number,
    w: number,
    size: number,
    style: "normal" | "bold" = "normal",
    color: RGB = INK,
    lh = 1.35,
  ) => {
    const ls = lines(value, w, size, style);
    setInk(color);
    ls.forEach((l, i) => doc.text(l, x, ty + size * 0.85 + i * size * lh));
    return ls.length * size * lh;
  };

  const heading = (title: string, sub?: string) => {
    ensure(sub ? 52 : 38);
    setFill(NAVY);
    doc.roundedRect(MARGIN, y + 1, 4, 16, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setInk(NAVY);
    doc.text(title, MARGIN + 12, y + 13);
    y += 20;
    if (sub) {
      y += drawText(sub, MARGIN, y, contentW, 9, "normal", GREY);
      y += 2;
    }
    y += 8;
  };

  const bar = (x: number, by: number, w: number, value: number, h = 6) => {
    setFill([234, 237, 242]);
    doc.roundedRect(x, by, w, h, h / 2, h / 2, "F");
    const pct = Math.max(0, Math.min(100, value)) / 100;
    setFill(toneColor(value));
    doc.roundedRect(x, by, Math.max(3, w * pct), h, h / 2, h / 2, "F");
  };

  const scoreRow = (
    x: number,
    ry: number,
    w: number,
    label: string,
    value: number,
    sub?: string,
  ) => {
    const labelW = w - 34;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setInk(INK);
    doc.text(lines(label, labelW, 8.5)[0] ?? label, x, ry + 7);
    doc.setFont("helvetica", "bold");
    setInk(toneColor(value));
    doc.text(String(Math.round(value)), x + w, ry + 7, { align: "right" });
    bar(x, ry + 11, w, value, 5);
    let h = 20;
    if (sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setInk(GREY);
      doc.text(lines(sub, labelW, 7.5)[0] ?? sub, x, ry + 26);
      h = 32;
    }
    return h;
  };

  const pill = (x: number, py: number, label: string, fg: RGB, bg: RGB) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const w = doc.getTextWidth(label) + 12;
    setFill(bg);
    doc.roundedRect(x, py, w, 13, 6.5, 6.5, "F");
    setInk(fg);
    doc.text(label, x + 6, py + 9);
    return w;
  };

  const card = (
    x: number,
    cy: number,
    w: number,
    h: number,
    fill: RGB = [255, 255, 255],
    border: RGB = LINE,
  ) => {
    setFill(fill);
    setDraw(border);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, cy, w, h, 9, 9, "FD");
  };

  const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
    const steps = Math.max(4, Math.round(Math.abs(to - from) / 0.06));
    let px = cx + r * Math.cos(from);
    let py = cy + r * Math.sin(from);
    for (let i = 1; i <= steps; i += 1) {
      const a = from + ((to - from) * i) / steps;
      const nx = cx + r * Math.cos(a);
      const ny = cy + r * Math.sin(a);
      doc.line(px, py, nx, ny);
      px = nx;
      py = ny;
    }
  };

  // ---------- cover header ----------
  const headerH = 128;
  setFill(NAVY);
  doc.rect(0, 0, pageW, headerH, "F");
  // subtle layered accent
  setFill([32, 58, 118]);
  doc.circle(pageW - 60, 20, 90, "F");
  setFill(NAVY);
  doc.rect(0, headerH, pageW, 8, "F");
  setFill(GOLD);
  doc.rect(0, headerH, pageW, 3.5, "F");
  if (platformImg) {
    try {
      doc.addImage(platformImg, "PNG", MARGIN, 30, 58, 58);
    } catch {
      /* ignore */
    }
  }
  const hx = MARGIN + (platformImg ? 72 : 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setInk(GOLD);
  doc.text("LAPORAN FINAL · TARUNA FUTURE SCANNER", hx, 44);
  doc.setFontSize(19);
  setInk([255, 255, 255]);
  doc.text("Laporan Kesiapan Calon Taruna", hx, 68);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  setInk([206, 216, 235]);
  const metaText = [
    data.participant.fullName || "Peserta",
    data.participant.targetInstitution,
    data.participant.targetProgram,
    data.participant.city,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.text(lines(metaText, contentW - 150, 9.5)[0] ?? metaText, hx, 86);
  doc.setFontSize(8.5);
  setInk([160, 178, 210]);
  doc.text(
    `Kode Asesmen: ${data.participant.code || "-"}   |   Dibuat ${new Date(data.generatedAt).toLocaleDateString("id-ID")}`,
    hx,
    102,
  );
  if (brandImg) {
    try {
      doc.addImage(brandImg, "PNG", pageW - MARGIN - 122, 34, 122, 30);
    } catch {
      /* ignore */
    }
  }
  y = headerH + 26;

  // ---------- hero: gauge + strongest ----------
  const sorted = [...(data.modules || [])].sort((a, b) => b.normalized - a.normalized);
  if (data.overall) {
    const heroH = 168;
    const gaugeW = contentW * 0.42;
    const rightW = contentW - gaugeW - 14;
    const rightX = MARGIN + gaugeW + 14;
    ensure(heroH + 12);

    card(MARGIN, y, gaugeW, heroH, [248, 250, 253]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setInk(GREY);
    doc.text("INDEKS KESIAPAN", MARGIN + gaugeW / 2, y + 22, { align: "center" });

    const cx = MARGIN + gaugeW / 2;
    const gy = y + 106;
    const r = 58;
    doc.setLineWidth(13);
    doc.setLineCap("round");
    setDraw([226, 231, 239]);
    arc(cx, gy, r, Math.PI, Math.PI * 2);
    const pct = Math.max(0, Math.min(100, data.overall.readiness)) / 100;
    setDraw(toneColor(data.overall.readiness));
    if (pct > 0.001) arc(cx, gy, r, Math.PI, Math.PI + Math.PI * pct);
    // needle dot
    const na = Math.PI + Math.PI * pct;
    setFill(NAVY);
    doc.circle(cx + r * Math.cos(na), gy + r * Math.sin(na), 4.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    setInk(NAVY);
    doc.text(String(Math.round(data.overall.readiness)), cx, gy - 6, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setInk(GREY);
    doc.text("dari 100", cx, gy + 8, { align: "center" });
    const catW = doc.getTextWidth(data.overall.category) + 16;
    pill(
      cx - catW / 2 + 2,
      gy + 18,
      data.overall.category,
      toneColor(data.overall.readiness),
      toneTint(data.overall.readiness),
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setInk(GREY);
    doc.text("Rendah · Sedang · Tinggi · Sangat Tinggi", cx, y + heroH - 12, { align: "center" });

    card(rightX, y, rightW, heroH, [255, 255, 255]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setInk(GREY);
    doc.text("SUB-TES TERKUAT", rightX + 16, y + 22);
    const top = sorted[0];
    if (top) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      setInk(NAVY);
      doc.text(lines(top.name, rightW - 32, 12, "bold")[0] ?? top.name, rightX + 16, y + 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setInk(GREY);
      doc.text(`${top.code} · ${top.category}`, rightX + 16, y + 53);
    }
    let ry = y + 64;
    sorted.slice(0, 4).forEach((m) => {
      ry += scoreRow(rightX + 16, ry, rightW - 32, m.name, m.normalized);
    });
    if (data.overall.interpretation) {
      setDraw(LINE);
      doc.setLineWidth(0.6);
      doc.line(rightX + 16, ry, rightX + rightW - 16, ry);
      const ls = lines(data.overall.interpretation, rightW - 32, 7.5);
      setInk(GREY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      ls.slice(0, 3).forEach((l, i) => doc.text(l, rightX + 16, ry + 12 + i * 10));
    }
    y += heroH + 20;
  }

  // ---------- radar ----------
  if (data.modules.length >= 3) {
    const boxH = 250;
    ensure(boxH + 16);
    card(MARGIN, y, contentW, boxH, [252, 253, 255]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setInk(NAVY);
    doc.text("Profil Sembilan Sub-Tes", MARGIN + 16, y + 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setInk(GREY);
    doc.text("Semakin luas area, semakin merata kesiapan antar sub-tes.", MARGIN + 16, y + 37);

    const cx = pageW / 2;
    const cy = y + boxH / 2 + 18;
    const R = 84;
    const n = data.modules.length;
    const ang = (i: number) => -Math.PI / 2 + (Math.PI * 2 * i) / n;
    doc.setLineWidth(0.6);
    doc.setLineCap("butt");
    [0.25, 0.5, 0.75, 1].forEach((ring) => {
      setDraw([220, 225, 234]);
      for (let i = 0; i < n; i += 1) {
        const a1 = ang(i);
        const a2 = ang((i + 1) % n);
        doc.line(
          cx + R * ring * Math.cos(a1),
          cy + R * ring * Math.sin(a1),
          cx + R * ring * Math.cos(a2),
          cy + R * ring * Math.sin(a2),
        );
      }
    });
    setDraw([230, 234, 241]);
    for (let i = 0; i < n; i += 1)
      doc.line(cx, cy, cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i)));

    const pts = data.modules.map((m, i) => {
      const v = Math.max(0, Math.min(100, m.normalized)) / 100;
      return [cx + R * v * Math.cos(ang(i)), cy + R * v * Math.sin(ang(i))] as [number, number];
    });
    setFill([46, 106, 200]);
    setDraw(NAVY);
    doc.setLineWidth(1.4);
    const first = pts[0]!;
    const deltas: [number, number][] = [];
    for (let i = 1; i < pts.length; i += 1) {
      deltas.push([pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]]);
    }
    const last = pts[pts.length - 1]!;
    deltas.push([first[0] - last[0], first[1] - last[1]]);
    doc.setGState(doc.GState({ opacity: 0.28 }));
    doc.lines(deltas, first[0], first[1], [1, 1], "F", true);
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.lines(deltas, first[0], first[1], [1, 1], "S", true);
    pts.forEach(([px, py], i) => {
      setFill(toneColor(data.modules[i]!.normalized));
      doc.circle(px, py, 2.6, "F");
    });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    data.modules.forEach((m, i) => {
      const a = ang(i);
      const lx = cx + (R + 20) * Math.cos(a);
      const ly = cy + (R + 20) * Math.sin(a) + 2.5;
      const align = Math.abs(Math.cos(a)) < 0.3 ? "center" : Math.cos(a) > 0 ? "left" : "right";
      setInk(NAVY);
      doc.text(m.code, lx, ly, { align: align as "left" });
      setInk(toneColor(m.normalized));
      doc.text(String(Math.round(m.normalized)), lx, ly + 9, { align: align as "left" });
    });
    y += boxH + 20;
  }

  // ---------- strengths / development ----------
  const dualList = (title: string, items: Dim[], accent: RGB, tint: RGB) => {
    const safeItems = items || [];
    const h = 42 + safeItems.length * 30;
    return { title, items: safeItems, accent, tint, h };
  };
  const strengths = data.strengths || [];
  const devAreas = data.developmentAreas || [];
  if (strengths.length || devAreas.length) {
    const colW = (contentW - 14) / 2;
    const blocks = [
      dualList("Tiga Kekuatan Utama", strengths, GREEN, [240, 250, 244]),
      dualList("Tiga Area Pengembangan", devAreas, ORANGE, [254, 247, 236]),
    ];
    const h = Math.max(...blocks.map((b) => b.h));
    ensure(h + 16);
    blocks.forEach((b, idx) => {
      const x = MARGIN + idx * (colW + 14);
      card(x, y, colW, h, b.tint, [b.accent[0], b.accent[1], b.accent[2]]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      setInk(b.accent);
      doc.text(b.title, x + 14, y + 24);
      let ry = y + 36;
      b.items.forEach((d) => {
        ry += scoreRow(x + 14, ry, colW - 28, d.name, d.normalized, d.moduleName);
      });
    });
    y += h + 20;
  }

  // ---------- module grid ----------
  heading("Rincian per Sub-Tes", "Skor sembilan sub-tes beserta dimensi pendukungnya.");
  const colW = (contentW - 14) / 2;
  const moduleHeight = (m: Mod) => {
    let h = 70;
    if (m.interpretation) h += lines(m.interpretation, colW - 28, 7.5).length * 10 + 2;
    h += (m.dimensions?.length || 0) * 20 + 6;
    return h;
  };
  const drawModule = (m: Mod, x: number, my: number, h: number) => {
    card(x, my, colW, h, toneTint(m.normalized), toneColor(m.normalized));
    const pw = pill(x + 14, my + 14, m.code, [255, 255, 255], NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setInk(INK);
    doc.text(lines(m.name, colW - 34 - pw, 9, "bold")[0] ?? m.name, x + 14 + pw + 6, my + 23);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    setInk(toneColor(m.normalized));
    doc.text(String(Math.round(m.normalized)), x + 14, my + 54);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setInk(GREY);
    doc.text(`/ 100 · ${toneLabel(m.normalized)} · ${m.category}`, x + 46, my + 52);
    bar(x + 14, my + 60, colW - 28, m.normalized, 5);
    let iy = my + 74;
    if (m.interpretation) {
      iy += drawText(m.interpretation, x + 14, iy - 4, colW - 28, 7.5, "normal", GREY) + 2;
    }
    setDraw(LINE);
    doc.setLineWidth(0.6);
    doc.line(x + 14, iy - 4, x + colW - 14, iy - 4);
    (m.dimensions || []).forEach((d) => {
      iy += scoreRow(x + 14, iy, colW - 28, d.name, d.normalized);
    });
  };
  for (let i = 0; i < data.modules.length; i += 2) {
    const a = data.modules[i]!;
    const b = data.modules[i + 1];
    const h = Math.max(moduleHeight(a), b ? moduleHeight(b) : 0);
    ensure(h + 14);
    drawModule(a, MARGIN, y, h);
    if (b) drawModule(b, MARGIN + colW + 14, y, h);
    y += h + 14;
  }
  y += 8;

  // ---------- recommendations ----------
  const recs = (data.modules || []).flatMap((m) =>
    (m.recommendations || []).map((r) => ({ ...r, code: m.code, score: m.normalized })),
  );
  if (recs.length) {
    heading("Rekomendasi Pengembangan", "Langkah konkret berdasarkan kategori skor tiap sub-tes.");
    const rw = (contentW - 12) / 2;
    const recH = (r: (typeof recs)[number]) =>
      34 + lines(r.title, rw - 24, 9, "bold").length * 11 + lines(r.body, rw - 24, 7.5).length * 10;
    for (let i = 0; i < recs.length; i += 2) {
      const items = [recs[i]!, recs[i + 1]].filter(Boolean) as typeof recs;
      const h = Math.max(...items.map(recH));
      ensure(h + 12);
      items.forEach((r, idx) => {
        const x = MARGIN + idx * (rw + 12);
        card(x, y, rw, h, [255, 255, 255]);
        setFill(toneColor(r.score));
        doc.roundedRect(x, y + 10, 3.5, h - 20, 2, 2, "F");
        const pw = pill(x + 14, y + 12, r.code, NAVY, [237, 241, 249]);
        let ty = y + 30;
        ty += drawText(r.title, x + 14, ty, rw - 28 - (pw > rw - 60 ? pw : 0), 9, "bold", INK);
        drawText(r.body, x + 14, ty + 2, rw - 28, 7.5, "normal", GREY);
      });
      y += h + 12;
    }
    y += 6;
  }

  // ---------- 30/60/90 ----------
  if (devAreas.length) {
    heading("Rencana 30 / 60 / 90 Hari");
    const phases = [
      {
        label: "30 HARI",
        title: "Perkuat fondasi",
        area: devAreas[0]?.name ?? "",
        steps: ["Pelajari materi dasar", "Latihan harian 20 menit", "Catat progres mingguan"],
      },
      {
        label: "60 HARI",
        title: "Latihan terukur",
        area: devAreas[1]?.name ?? devAreas[0]?.name ?? "",
        steps: ["Simulasi terjadwal", "Evaluasi skor tiap 2 minggu", "Umpan balik mentor"],
      },
      {
        label: "90 HARI",
        title: "Siap uji",
        area: devAreas[2]?.name ?? devAreas[0]?.name ?? "",
        steps: ["Simulasi penuh", "Perbaiki titik lemah sisa", "Kunci rutinitas harian"],
      },
    ];
    const pw = (contentW - 24) / 3;
    const h = 132;
    ensure(h + 16);
    phases.forEach((p, idx) => {
      const x = MARGIN + idx * (pw + 12);
      card(x, y, pw, h, [248, 250, 253]);
      pill(x + 12, y + 12, p.label, [255, 255, 255], NAVY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setInk(INK);
      doc.text(p.title, x + 12, y + 44);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setInk(NAVY_SOFT);
      const areaLines = lines(`Fokus: ${p.area}`, pw - 24, 7.5, "bold");
      areaLines.slice(0, 2).forEach((l, i) => doc.text(l, x + 12, y + 58 + i * 9));
      let sy = y + 58 + Math.min(2, areaLines.length) * 9 + 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      p.steps.forEach((s) => {
        setFill(GOLD);
        doc.circle(x + 14, sy - 2.5, 1.7, "F");
        setInk(GREY);
        const ls = lines(s, pw - 32, 7.5);
        ls.forEach((l, i) => doc.text(l, x + 20, sy + i * 9));
        sy += ls.length * 9 + 3;
      });
    });
    y += h + 18;
  }

  // ---------- disclaimer ----------
  ensure(46);
  drawText(
    `Laporan ini bersifat rahasia dan digunakan untuk keperluan pembinaan. Hasil bukan diagnosis medis maupun keputusan seleksi resmi. ID Asesmen: ${data.assessmentId} · Dibuat ${new Date(data.generatedAt).toLocaleString("id-ID")}`,
    MARGIN,
    y,
    contentW,
    7.5,
    "normal",
    GREY,
  );

  // ---------- footers ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    setDraw(LINE);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, pageH - 32, pageW - MARGIN, pageH - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setInk(GREY);
    doc.text("Akademi Prestasi · Taruna Future Scanner", MARGIN, pageH - 18);
    doc.text(`Halaman ${i} / ${pages}`, pageW - MARGIN, pageH - 18, { align: "right" });
  }

  const safeName = (data.participant.fullName || "peserta")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  doc.save(`Laporan-TFS-${safeName || "peserta"}.pdf`);
}
