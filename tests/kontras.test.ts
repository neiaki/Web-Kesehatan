import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kontras warna teks di atas latar.
 *
 * Nilainya dibaca dari berkas CSS sungguhan, lalu dihitung ulang di dalam tes
 * ini. Menyalin hasil hitungan ke dalam tes membuat pengawalan itu tidak
 * berguna: CSS berubah, tes tetap hijau, dan tidak ada yang diberi tahu.
 *
 * Ambang 4.5:1 adalah WCAG 1.4.3 untuk teks biasa. Teks besar 24px atau
 * 18.66px tebal-bold hanya butuh 3:1 dan tidak ikut di sini.
 *
 * Dua token ini lahir dari pengukuran, bukan dari tebakan. Aksen `#1977cc`
 * berdiri di atas pita `--rs-section-light` hanya 4.27:1, dan abu-abu
 * `#6b7280` hanya 4.48:1, jadi keduanya gagal. Nilainya digelapkan sedikit,
 * bukan diganti rona, supaya tetap terbaca sebagai warna yang sama.
 */

const AKAR = process.cwd();
const TOKEN = readFileSync(path.join(AKAR, "src/styles/tokens.css"), "utf8");
const PAGES = readFileSync(path.join(AKAR, "src/styles/pages.css"), "utf8");
const SITE = readFileSync(path.join(AKAR, "src/styles/site.css"), "utf8");
const HOME = readFileSync(path.join(AKAR, "src/styles/home.css"), "utf8");

function token(nama: string): string {
  const cocok = TOKEN.match(new RegExp(`--${nama}:\\s*(#[0-9a-f]{3,8})`, "i"));
  if (!cocok) throw new Error(`token --${nama} tidak ada di tokens.css`);
  return cocok[1];
}

function keRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const penuh = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(penuh.slice(0, 2), 16),
    parseInt(penuh.slice(2, 4), 16),
    parseInt(penuh.slice(4, 6), 16),
  ];
}

function lin(kanal: number): number {
  const c = kanal / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminansi([r, g, b]: [number, number, number]): number {
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Rasio kontras WCAG antara dua warna hex. */
export function kontras(a: string, b: string): number {
  const la = luminansi(keRgb(a));
  const lb = luminansi(keRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const PUTIH = token("rs-white");
const PITA = token("rs-section-light");

describe("kontras token", () => {
  it("aksen teks tautan cukup di atas pita header dan di atas putih", () => {
    // Dipakai `.page-help a`, `.breadcrumb a`, dan `.link-more`, ketiganya
    // berdiri di atas pita atau putih.
    expect(kontras(token("rs-accent-teks"), PITA)).toBeGreaterThanOrEqual(4.5);
    expect(kontras(token("rs-accent-teks"), PUTIH)).toBeGreaterThanOrEqual(4.5);
  });

  it("aksen penuh tetap cukup di atas putih", () => {
    // Dipakai untuk tombol, navbar, dan garis. Angkanya sudah diverifikasi
    // terhadap situs acuan dan tidak boleh berubah diam-diam.
    expect(kontras(token("rs-accent"), PUTIH)).toBeGreaterThanOrEqual(4.5);
  });

  it("aksen penuh memang gagal di atas pita, itu alasan token teksnya ada", () => {
    // Kalau nanti angka ini ikut naik, token `--rs-accent-teks` tidak
    // diperlukan lagi dan tiga pemakainya bisa kembali ke `--rs-accent`.
    // Tes inilah yang memberi tahu waktunya.
    expect(kontras(token("rs-accent"), PITA)).toBeLessThan(4.5);
  });

  it("teks redup cukup di atas pita dan di atas putih", () => {
    // Menggantikan `#6b7280` yang ditulis langsung di beberapa berkas.
    expect(kontras(token("rs-text-lembut"), PITA)).toBeGreaterThanOrEqual(4.5);
    expect(kontras(token("rs-text-lembut"), PUTIH)).toBeGreaterThanOrEqual(4.5);
  });

  it("teks utama dan judul cukup di atas putih dan pita header", () => {
    for (const latar of [PUTIH, PITA]) {
      expect(kontras(token("rs-text-body"), latar)).toBeGreaterThanOrEqual(4.5);
      expect(kontras(token("rs-text-heading"), latar)).toBeGreaterThanOrEqual(4.5);
      expect(kontras(token("rs-text-nav"), latar)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("warna code bawaan Bootstrap digelapkan agar cukup di atas pita", () => {
    // Bootstrap memakai #d63384 yang hanya 4.17:1 di atas pita.
    const kode = TOKEN.match(/\ncode\s*\{[^}]*color:\s*(#[0-9a-f]{3,8})/i);
    if (!kode) throw new Error("blok code tidak lagi menimpa warna di tokens.css");
    expect(kontras(kode[1], PITA)).toBeGreaterThanOrEqual(4.5);
    expect(kontras(kode[1], PUTIH)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("pemakaian token teks", () => {
  it("tiga pemakai utama tidak menunjuk aksen penuh di atas pita", () => {
    // Kalau salah satu kembali ke `--rs-accent`, kontrasnya turun ke 4.27:1.
    // CSS masih lolos build dan tidak ada yang diberi tahu.
    expect(PAGES).toMatch(/\.page-help a\s*\{[^}]*color:\s*var\(--rs-accent-teks\)/);
    expect(SITE).toMatch(/\.breadcrumb a\s*\{[^}]*color:\s*var\(--rs-accent-teks\)/);
    expect(TOKEN).toMatch(/\.link-more\s*\{[^}]*color:\s*var\(--rs-accent-teks\)/);
  });

  it("tidak ada #6b7280 yang ditulis langsung lagi", () => {
    // Poin yang sama di tiga berkas. Kembalinya warna asal berarti catatan kaki
    // turun ke 4.48:1 tanpa ada yang melihat.
    for (const [nama, isi] of [
      ["home.css", HOME],
      ["pages.css", PAGES],
      ["site.css", SITE],
    ] as const) {
      expect(isi, `${nama} masih menulis #6b7280 langsung`).not.toMatch(
        /#6b7280/i,
      );
    }
  });
});