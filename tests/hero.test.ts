import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tinggi hero dan ruang yang harus disisakan untuk titik paginasi.
 *
 * Dua angka di sini saling mengikat dan tidak bisa diubah satu per satu.
 *
 * `.swiperslider` memakai `min(303px, 23.67vw)`, jadi hero menyusut ikut lebar
 * viewport: 303px di 1280px, 182px di 768px, 92px di 390px, dan hanya 76px di
 * 320px. Tinggi itu terverifikasi dari situs acuan, jadi perbaikan untuk layar
 * kecil wajib datang dari isi caption, bukan dari menambah tinggi hero.
 *
 * Titik paginasi menempel di dasar hero, jadi beberapa piksel terakhir hero
 * bukan tempat caption. Cadangan itu boleh sesempit mungkin asal kontainer
 * paginasinya benar-benar setinggi bulatnya.
 *
 * Kontainer paginasi secara bawaan Swiper memakai `inline-block`, dan itu
 * membuatnya 24px padahal bulatnya cuma 11px. Selisih 13px itu celah
 * descender, bukan isi. Pada lebar 320px hero cuma 76px, dan 13px yang terbuang
 * itu cukup untuk membuat judul caption terpotong di tepi atas.
 *
 * Semua nilai di bawah dibaca dari berkas CSS sungguhan. Menyalinnya ke dalam
 * tes hanya membuat pengawalan terasa ada sementara tidak-awalnya tidak
 * terkawal.
 */

const HOME = readFileSync(
  path.join(process.cwd(), "src/styles/home.css"),
  "utf8",
);

/** Ambil nilai px dari deklarasi CSS pertama yang cocok. */
function deklarasi(pola: RegExp, properti: string): number {
  const blok = HOME.match(pola);
  if (!blok) throw new Error(`blok ${pola} tidak ada di home.css`);
  const nilai = blok[0].match(new RegExp(`${properti}:\\s*([\\d.]+)px`));
  if (!nilai) throw new Error(`${properti} px tidak ditemukan di ${pola}`);
  return parseFloat(nilai[1]);
}

/**
 * Ubah rem ke px. Asumsi akar 16px, sama seperti yang dipakai halaman.
 *
 * Masukan berupa angka yang sudah dipisah dari satuan-nya, jadi fungsi ini
 * tidak perlu mencari satuan apa pun di teksnya.
 */
function rem(angka: string): number {
  return parseFloat(angka) * 16;
}

/**
 * Jarak kontainer paginasi dari tepi bawah hero.
 *
 * Bukan angka ours: itu bawaan Swiper di `swiper/css/pagination`, jadi tidak
 * ada di berkas mana pun yang bisa dibaca tes ini. Diukur lewat
 * `getComputedStyle()` dan hasilnya 8px.
 */
const PAGINASI_DARI_BAWAH = 8;

/** Tinggi hero pada lebar tertentu, dari `min(303px, 23.67vw)`. */
function tinggiHero(lebar: number): number {
  const vw = HOME.match(/\.swiperslider\s*\{[^}]*height:\s*min\((\d+)px,\s*([\d.]+)vw\)/);
  if (!vw) throw new Error("tinggi .swiperslider tidak lagi min(px, vw)");
  return Math.min(parseFloat(vw[1]), (parseFloat(vw[2]) * lebar) / 100);
}

describe("tinggi hero", () => {
  it("tetap mengikuti min(303px, 23.67vw) yang terverifikasi", () => {
    // Nilai acuan diukur di peramban, jadi bulat: 1280px -> 303px,
    // 768px -> 182px, 390px -> 92px, 320px -> 76px. Rumusnya menghasilkan
    // pecahan, jadi yang dibandingkan adalah hasil pembulatan yang sama dengan
    // yang dibaca `getBoundingClientRect()`.
    expect(Math.round(tinggiHero(1280))).toBe(303);
    expect(Math.round(tinggiHero(768))).toBe(182);
    expect(Math.round(tinggiHero(390))).toBe(92);
    expect(Math.round(tinggiHero(320))).toBe(76);
  });

  it("tidak pernah lebih besar dari 303px di lebar mana pun", () => {
    for (const lebar of [320, 390, 768, 1280, 1920, 2560]) {
      expect(tinggiHero(lebar)).toBeLessThanOrEqual(303);
    }
  });
});

describe("ruang untuk titik paginasi", () => {
  it("kontainer paginasi diratakan flex supaya tidak menambah tinggi sia-sia", () => {
    // Tanpa ini kontainer jadi 24px, bukan 11px, dan 13px selisih itu langsung
    // dimakan hero yang cuma 76px pada lebar 320px.
    expect(HOME).toMatch(
      /\.swiperslider \.swiper-pagination\s*\{[^}]*display:\s*flex/,
    );
  });

  it("ukuran bulat tetap 11px seperti di situs acuan", () => {
    expect(
      deklarasi(/\.swiper-pagination-bullet\s*\{[^}]*\}/, "height"),
    ).toBe(11);
    expect(
      deklarasi(/\.swiper-pagination-bullet\s*\{[^}]*\}/, "width"),
    ).toBe(11);
  });

  it("padding bawah caption menutupi zona paginasi", () => {
    const blok = HOME.match(
      /@media \(max-width: 991\.98px\) \{\s*\.slide-overlay\s*\{([^}]*)\}/,
    );
    if (!blok) throw new Error("blok .slide-overlay di layar kecil tidak ada");
    const padB = blok[1].match(/padding:\s*([^;]+);/);
    if (!padB) throw new Error("padding .slide-overlay tidak ditemukan");

    // Padding bawah caption harus minimal sebesar bulat plus jaraknya dari
    // tepi bawah hero.
    expect(rem(padB[1].split(/\s+/)[2])).toBeGreaterThanOrEqual(
      11 + PAGINASI_DARI_BAWAH,
    );
  });
});

describe("trade-off isi hero di layar kecil", () => {
  it("subjudul disembunyikan, tombol tidak", () => {
    // Di bawah 576px ruangnya tidak cukup untuk tiga lapis isi sekaligus.
    // Yang dilepas adalah kalimat penjelasan. Melepas tombol akan membuat
    // beranda kehilangan aksi utamanya di ponsel, dan itu kerugian yang jauh
    // lebih mahal daripada hilangnya satu kalimat pendukung.
    const blok = HOME.match(
      /@media \(max-width: 575\.98px\) \{\s*\.slide-overlay p\s*\{([^}]*)\}/,
    );
    expect(blok).not.toBeNull();
    expect(blok?.[1]).toMatch(/display:\s*none/);

    // Tombol hanya dikecilkan, tidak pernah disembunyikan.
    expect(HOME).not.toMatch(/\.slide-overlay \.btn\s*\{[^}]*display:\s*none/);
  });

  it("penyempitan berlaku sampai 991.98px, bukan hanya 767.98px", () => {
    // Pada 768px hero baru 182px, sementara overlay versi lama setinggi 201px.
    // Isinya muat, tapi overlainya lebih tinggi dari hero sehingga tombolnya
    // turun ke zona paginasi. Karena itu batasnya mengikuti lebar tablet.
    expect(HOME).toMatch(/@media \(max-width: 991\.98px\)/);
  });

  it("judul tetap punya ukuran yang bisa dibaca di 320px", () => {
    // 0.95rem = 15.2px. Judul terpanjang 30 karakter harus muat satu baris
    // di 304px ruang yang tersisa setelah padding 0.5rem di kiri dan kanan.
    const blok = HOME.match(
      /@media \(max-width: 991\.98px\)[\s\S]*?\.slide-overlay h2\s*\{([^}]*)\}/,
    );
    if (!blok) throw new Error("aturan .slide-overlay h2 di layar kecil tidak ada");
    const ukuran = blok[1].match(/font-size:\s*clamp\(([\d.]+)rem/);
    if (!ukuran) throw new Error("ukuran huruf judul di clamp tidak ditemukan");
    expect(rem(ukuran[1])).toBeGreaterThanOrEqual(15);
  });
});