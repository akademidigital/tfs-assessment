import type { AdminStudentItem } from "@/lib/assessment.server";

function escapeXml(str: unknown): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Ekspor data peserta ke format Microsoft Excel XML Spreadsheet (.xls).
 * Menghasilkan file Excel dengan styling profesional, header rapi, zebra striping,
 * dan menjaga agar nomor WhatsApp & Kode Peserta tidak kehilangan angka 0 di depan.
 */
export function exportParticipantsToExcel(
  students: AdminStudentItem[],
  filename = "data-peserta-tfs.xls",
) {
  const nowStr = new Date().toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const columns = [
    { label: "No", width: 40 },
    { label: "Kode Peserta", width: 100 },
    { label: "Nama Lengkap", width: 180 },
    { label: "Jenis Kelamin", width: 90 },
    { label: "No. WhatsApp", width: 120 },
    { label: "Email", width: 180 },
    { label: "Asal Sekolah", width: 170 },
    { label: "Kelas", width: 70 },
    { label: "Jurusan", width: 90 },
    { label: "Kota / Domisili", width: 130 },
    { label: "Tempat Lahir", width: 110 },
    { label: "Tanggal Lahir", width: 95 },
    { label: "Tinggi (cm)", width: 75 },
    { label: "Berat (kg)", width: 75 },
    { label: "Target Institusi", width: 120 },
    { label: "Target Program", width: 130 },
    { label: "Nama Orang Tua / Wali", width: 160 },
    { label: "WhatsApp Orang Tua", width: 130 },
    { label: "Sumber Informasi", width: 110 },
    { label: "Status Asesmen", width: 120 },
    { label: "Modul Selesai", width: 95 },
    { label: "Indeks Kesiapan (%)", width: 120 },
    { label: "Kategori Kesiapan", width: 120 },
    { label: "Tanggal Registrasi", width: 130 },
    { label: "Tanggal Selesai", width: 130 },
  ];

  const colTags = columns.map((c) => `<Column ss:Width="${c.width}"/>`).join("\n    ");

  const headerCells = columns
    .map(
      (c) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`,
    )
    .join("\n     ");

  const rowsXml = students
    .map((s, idx) => {
      const isAlt = idx % 2 === 1;
      const rStyle = isAlt ? "CellRegularAlt" : "CellRegular";
      const cStyle = isAlt ? "CellCenterAlt" : "CellCenter";
      const tStyle = isAlt ? "CellTextAlt" : "CellText";

      const readinessScore = s.session?.readinessScore != null ? s.session.readinessScore : "-";

      return `    <Row ss:Height="22">
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="Number">${idx + 1}</Data></Cell>
     <Cell ss:StyleID="${tStyle}"><Data ss:Type="String">${escapeXml(s.code || "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.fullName || "-")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(s.gender || "-")}</Data></Cell>
     <Cell ss:StyleID="${tStyle}"><Data ss:Type="String">${escapeXml(s.whatsapp || "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.email || "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.schoolName || "-")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(s.classLevel || "-")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(s.major || "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.city || "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.birthPlace || "-")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(s.birthDate || "-")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(s.heightCm ?? "-")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(s.weightKg ?? "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.targetInstitution || "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.targetProgram || "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.guardianName || "-")}</Data></Cell>
     <Cell ss:StyleID="${tStyle}"><Data ss:Type="String">${escapeXml(s.guardianWhatsapp || "-")}</Data></Cell>
     <Cell ss:StyleID="${rStyle}"><Data ss:Type="String">${escapeXml(s.referralSource || "-")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(s.session?.isCompleted ? "Selesai" : "Sedang Mengerjakan")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(`${s.session?.completedModulesCount ?? 0}/${s.session?.totalModulesCount ?? 9}`)}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(readinessScore)}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(s.session?.readinessCategory || "-")}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(formatDate(s.registeredAt))}</Data></Cell>
     <Cell ss:StyleID="${cStyle}"><Data ss:Type="String">${escapeXml(formatDate(s.session?.completedAt))}</Data></Cell>
    </Row>`;
    })
    .join("\n");

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Data Peserta Asesmen Taruna Future Scanner</Title>
  <Subject>Data Peserta Asesmen TFS</Subject>
  <Author>Akademi Prestasi</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Title">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#1E3A8A"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="9.5" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#334155"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1E293B"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellRegular">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellRegularAlt">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellCenterAlt">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="CellText">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="@"/>
  </Style>
  <Style ss:ID="CellTextAlt">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="@"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Data Peserta TFS">
  <Table ss:DefaultRowHeight="20">
    ${colTags}
   <Row ss:Height="26">
    <Cell ss:StyleID="Title" ss:MergeAcross="${columns.length - 1}"><Data ss:Type="String">DATA PESERTA ASESMEN — TARUNA FUTURE SCANNER</Data></Cell>
   </Row>
   <Row ss:Height="18">
    <Cell ss:StyleID="Subtitle" ss:MergeAcross="${columns.length - 1}"><Data ss:Type="String">Akademi Prestasi · Waktu Ekspor: ${escapeXml(nowStr)} · Total Data: ${students.length} Peserta</Data></Cell>
   </Row>
   <Row ss:Height="10"/>
   <Row ss:Height="28">
     ${headerCells}
   </Row>
${rowsXml}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/>
   <FrozenNoSplit/>
   <SplitPane>
    <SplitPaneTop>4</SplitPaneTop>
   </SplitPane>
   <Selected/>
   <ProtectObjects>False</ProtectObjects>
   <ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xmlContent], { type: "application/vnd.ms-excel;charset=utf-8" });
  downloadBlob(blob, filename.endsWith(".xls") ? filename : `${filename}.xls`);
}

/**
 * Ekspor data peserta ke format CSV (UTF-8 with BOM).
 */
export function exportParticipantsToCsv(
  students: AdminStudentItem[],
  filename = "data-peserta-tfs.csv",
) {
  const headers = [
    "No",
    "Kode Peserta",
    "Nama Lengkap",
    "Jenis Kelamin",
    "No. WhatsApp",
    "Email",
    "Asal Sekolah",
    "Kelas",
    "Jurusan",
    "Kota / Domisili",
    "Tempat Lahir",
    "Tanggal Lahir",
    "Tinggi (cm)",
    "Berat (kg)",
    "Target Institusi",
    "Target Program",
    "Nama Orang Tua / Wali",
    "WhatsApp Orang Tua",
    "Sumber Informasi",
    "Status Asesmen",
    "Modul Selesai",
    "Indeks Kesiapan (%)",
    "Kategori Kesiapan",
    "Tanggal Registrasi",
    "Tanggal Selesai",
  ];

  const escapeCsv = (str: unknown) => {
    if (str == null) return '""';
    return `"${String(str).replace(/"/g, '""')}"`;
  };

  const rows = students.map((s, idx) => {
    const readinessScore = s.session?.readinessScore != null ? s.session.readinessScore : "-";

    return [
      idx + 1,
      escapeCsv(s.code || "-"),
      escapeCsv(s.fullName || "-"),
      escapeCsv(s.gender || "-"),
      s.whatsapp ? `'${s.whatsapp}` : '""',
      escapeCsv(s.email || "-"),
      escapeCsv(s.schoolName || "-"),
      escapeCsv(s.classLevel || "-"),
      escapeCsv(s.major || "-"),
      escapeCsv(s.city || "-"),
      escapeCsv(s.birthPlace || "-"),
      escapeCsv(s.birthDate || "-"),
      s.heightCm ?? "-",
      s.weightKg ?? "-",
      escapeCsv(s.targetInstitution || "-"),
      escapeCsv(s.targetProgram || "-"),
      escapeCsv(s.guardianName || "-"),
      s.guardianWhatsapp ? `'${s.guardianWhatsapp}` : '""',
      escapeCsv(s.referralSource || "-"),
      escapeCsv(s.session?.isCompleted ? "Selesai" : "Sedang Mengerjakan"),
      escapeCsv(`${s.session?.completedModulesCount ?? 0}/${s.session?.totalModulesCount ?? 9}`),
      readinessScore,
      escapeCsv(s.session?.readinessCategory || "-"),
      escapeCsv(formatDate(s.registeredAt)),
      escapeCsv(formatDate(s.session?.completedAt)),
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

