export interface SalahPrayer {
  name: string;
  totalRakats: number;
  rakatBreakdown: string;
  steps: string[];
}

export const SALAH_CURRICULUM: SalahPrayer[] = [
  {
    name: "Fajr (Morning)",
    totalRakats: 4,
    rakatBreakdown: "2 Sunnah Muakkadah + 2 Fard",
    steps: [
      "Wudu & Intention (Niyyah)",
      "Takbir-e-Tahreema & Qiyam",
      "Sana (Subhanaka Allahumma...)",
      "Ta'awwuz & Tasmiyah",
      "Surah Al-Fatihah",
      "Additional Surah / Ayahs",
      "Ruku & Tasbeeh (Subhana Rabbiyal Azeem)",
      "Qawmah (Sami Allahu Liman Hamidah, Rabbana Lakal Hamd)",
      "Sajdah 1 & Tasbeeh (Subhana Rabbiyal A'la)",
      "Jalsah (Sitting between two Sajdahs)",
      "Sajdah 2",
      "Qa'dah Akhirah: Tashahhud (Attahiyyaat)",
      "Durood-e-Ibrahim",
      "Dua Masura (Allahumma Inni Zalamtu...)",
      "Tasleem (Salam Right & Left)"
    ]
  },
  {
    name: "Dhuhr (Noon)",
    totalRakats: 12,
    rakatBreakdown: "4 Sunnah Muakkadah + 4 Fard + 2 Sunnah Muakkadah + 2 Nafl",
    steps: [
      "4 Sunnah: Rakat 1-4 with Qa'dah Oola (Tashahhud)",
      "4 Fard: Rakat 1-2 with Surah, Rakat 3-4 Fatihah only",
      "2 Sunnah: Rakat 1-2 standard recitation",
      "2 Nafl: Voluntary prayer",
      "Dua after prayer"
    ]
  },
  {
    name: "Asr (Late Afternoon)",
    totalRakats: 8,
    rakatBreakdown: "4 Sunnah Ghair Muakkadah + 4 Fard",
    steps: [
      "4 Sunnah (Optional/Recommended)",
      "4 Fard (Obligatory with silent recitation)",
      "Recitation pace & Khushoo practice"
    ]
  },
  {
    name: "Maghrib (Sunset)",
    totalRakats: 7,
    rakatBreakdown: "3 Fard + 2 Sunnah Muakkadah + 2 Nafl",
    steps: [
      "3 Fard: 2 audible recitations + 1 silent Rakat",
      "Middle sitting (Qa'dah Oola) after 2nd Rakat",
      "2 Sunnah Muakkadah",
      "2 Nafl"
    ]
  },
  {
    name: "Isha & Witr (Night)",
    totalRakats: 17,
    rakatBreakdown: "4 Sunnah + 4 Fard + 2 Sunnah + 2 Nafl + 3 Witr Wajib + 2 Nafl",
    steps: [
      "4 Fard recitation",
      "2 Sunnah Muakkadah",
      "3 Witr Wajib: 3rd Rakat Takbir with hands raised",
      "Dua Qunoot (Allahumma Inna Nasta'eenuka...)",
      "Salat-ul-Witr completion"
    ]
  },
  {
    name: "Essential Salah Duas & Memorization",
    totalRakats: 0,
    rakatBreakdown: "Core Recitations",
    steps: [
      "Takbeer, Sana & Ta'awwuz",
      "Surah Al-Fatihah with proper Tajweed",
      "Ruku & Sajdah Tasbeehs",
      "Tashahhud (Attahiyyaat)",
      "Durood Ibrahim (Full recitation with Tajweed)",
      "Dua Masura / Rabbana Atina",
      "Dua-e-Qunoot (for Witr)",
      "Ayat-ul-Kursi after Salah",
      "SubhanAllah (33x), Alhamdulillah (33x), Allahu Akbar (34x)"
    ]
  }
];
