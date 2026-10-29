export type BranchContact = {
  name: string;
  address: string;
  whatsapp: string;
  email?: string;
};

export const SUPPORT_BRANCHES: BranchContact[] = [
  {
    name: "Akademi Prestasi Learning Center",
    address:
      "Jl. Taman Villa Baru Jl. Villa Raya No.A21, Pekayon Jaya, Kec. Bekasi Selatan, Kota Bekasi, Jawa Barat 17148",
    whatsapp: "0813-2083-4632",
    email: "bekasi@akademiprestasi.com",
  },
  {
    name: "Akademi Prestasi Cabang Bandung",
    address:
      "Jl. Brigadir Jend. Katamso No.29, Sukamaju, Kec. Cibeunying Kaler, Kota Bandung, Jawa Barat 40122",
    whatsapp: "0852-8388-3908",
    email: "bandung@akademiprestasi.co.id",
  },
  {
    name: "Akademi Prestasi Cabang Palembang",
    address:
      "Jl. Perintis Kemerdekaan No.1219, Lawang Kidul, Kec. Ilir Tim. II, Kota Palembang, Sumatera Selatan 30111",
    whatsapp: "0821-7118-9495",
    email: "palembang@akademiprestasi.co.id",
  },
  {
    name: "Akademi Prestasi Cabang Yogyakarta",
    address:
      "Jl. Colombo No.23, Karang Malang, Caturtunggal, Kec. Depok, Kabupaten Sleman, Daerah Istimewa Yogyakarta 55281",
    whatsapp: "0812-2505-3197",
    email: "yogyakarta@akademiprestasi.co.id",
  },
  {
    name: "Akademi Prestasi Cabang Malang",
    address: "Jl. Hamid Rusdi No.97A, Bunulrejo, Kec. Blimbing, Kota Malang, Jawa Timur 65126",
    whatsapp: "0812-2975-4535",
    email: "malang@akademiprestasi.co.id",
  },
  {
    name: "Akademi Prestasi Cabang Hub Surabaya",
    address:
      "Jl. Gayungsari Barat No.103B, Gayungan, Kec. Gayungan, Kota Surabaya, Jawa Timur 60235",
    whatsapp: "0823-2068-1703",
    email: "surabaya@akademiprestasi.co.id",
  },
  {
    name: "Akademi Prestasi Cabang Hub Serpong",
    address:
      "Jl. Raya Serpong Kilometer 7 No.39, Pakulonan, Kec. Serpong Utara, Kota Tangerang Selatan, Banten 15325",
    whatsapp: "0851-3937-3782",
  },
  {
    name: "Akademi Prestasi Cabang Hub Malabar",
    address: "Jl. K.H. Ahmad Dahlan No.20, Malabar, Kec. Lengkong, Kota Bandung, Jawa Barat 40264",
    whatsapp: "0813-1447-418",
  },
  {
    name: "Akademi Prestasi Cabang Hub Sudirman",
    address:
      "One, The City Center - Menara Batavia, Jl. K.H. Mas Mansyur No.Kav. 126 Level 6, RT.1/RW.6, Karet Tengsin, Kecamatan Tanah Abang, Kota Jakarta Pusat, DKI Jakarta 10220",
    whatsapp: "0813-8976-3583",
  },
  {
    name: "Akademi Prestasi Cabang Hub Kebon Jeruk",
    address:
      "Jl. Lapangan Bola No.7 Nomor 5D, RT.8/RW.1, Kb. Jeruk, Kec. Kb. Jeruk, Kota Jakarta Barat, DKI Jakarta 11530",
    whatsapp: "0813-8976-3583",
  },
  {
    name: "Akademi Prestasi Cabang Hub Pamulang",
    address:
      "Tepat di seberang FTL, Jl. Dr. Setiabudi No.138A, RT.001/RW.002, Pamulang Tim., Kec. Pamulang, Kota Tangerang Selatan, Banten 15417",
    whatsapp: "0813-8976-3583",
  },
];

export function toWaNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return `62${digits}`;
}

export function waLink(
  phone: string,
  opts: { branch: string; name?: string | null; code?: string | null; readiness?: number | null },
) {
  const lines = [
    "Halo Tim Konsultan Akademi Prestasi,",
    "",
    "Saya baru menyelesaikan asesmen Taruna Future Scanner dan ingin konsultasi mengenai hasil saya.",
    opts.name ? `Nama: ${opts.name}` : null,
    opts.code ? `Kode Asesmen: ${opts.code}` : null,
    typeof opts.readiness === "number"
      ? `Indeks Kesiapan: ${Math.round(opts.readiness)}/100`
      : null,
    `Cabang tujuan: ${opts.branch}`,
    "",
    "Terima kasih.",
  ].filter(Boolean);
  return `https://wa.me/${toWaNumber(phone)}?text=${encodeURIComponent(lines.join("\n"))}`;
}
