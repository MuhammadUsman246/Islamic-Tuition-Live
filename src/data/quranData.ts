export interface SurahMeta {
  number: number;
  name: string;
  englishName: string;
  ayahCount: number;
}

export const SURAH_LIST: SurahMeta[] = [
  { number: 1, name: "الفاتحة", englishName: "Al-Fatihah", ayahCount: 7 },
  { number: 2, name: "البقرة", englishName: "Al-Baqarah", ayahCount: 286 },
  { number: 3, name: "آل عمران", englishName: "Ali 'Imran", ayahCount: 200 },
  { number: 4, name: "النساء", englishName: "An-Nisa", ayahCount: 176 },
  { number: 5, name: "المائدة", englishName: "Al-Ma'idah", ayahCount: 120 },
  { number: 6, name: "الأنعام", englishName: "Al-An'am", ayahCount: 165 },
  { number: 7, name: "الأعراف", englishName: "Al-A'raf", ayahCount: 206 },
  { number: 8, name: "الأنفال", englishName: "Al-Anfal", ayahCount: 75 },
  { number: 9, name: "التوبة", englishName: "At-Tawbah", ayahCount: 129 },
  { number: 10, name: "يونس", englishName: "Yunus", ayahCount: 109 },
  { number: 11, name: "هود", englishName: "Hud", ayahCount: 123 },
  { number: 12, name: "يوسف", englishName: "Yusuf", ayahCount: 111 },
  { number: 13, name: "الرعد", englishName: "Ar-Ra'd", ayahCount: 43 },
  { number: 14, name: "إبراهيم", englishName: "Ibrahim", ayahCount: 52 },
  { number: 15, name: "الحجر", englishName: "Al-Hijr", ayahCount: 99 },
  { number: 16, name: "النحل", englishName: "An-Nahl", ayahCount: 128 },
  { number: 17, name: "الإسراء", englishName: "Al-Isra", ayahCount: 111 },
  { number: 18, name: "الكهف", englishName: "Al-Kahf", ayahCount: 110 },
  { number: 19, name: "مريم", englishName: "Maryam", ayahCount: 98 },
  { number: 20, name: "طه", englishName: "Taha", ayahCount: 135 },
  { number: 21, name: "الأنبياء", englishName: "Al-Anbiya", ayahCount: 112 },
  { number: 22, name: "الحج", englishName: "Al-Hajj", ayahCount: 78 },
  { number: 23, name: "المؤمنون", englishName: "Al-Mu'minun", ayahCount: 118 },
  { number: 24, name: "النور", englishName: "An-Nur", ayahCount: 64 },
  { number: 25, name: "الفرقان", englishName: "Al-Furqan", ayahCount: 77 },
  { number: 26, name: "الشعراء", englishName: "Ash-Shu'ara", ayahCount: 227 },
  { number: 27, name: "النمل", englishName: "An-Naml", ayahCount: 93 },
  { number: 28, name: "القصص", englishName: "Al-Qasas", ayahCount: 88 },
  { number: 29, name: "العنكبوت", englishName: "Al-'Ankabut", ayahCount: 69 },
  { number: 30, name: "الروم", englishName: "Ar-Rum", ayahCount: 60 },
  { number: 31, name: "لقمان", englishName: "Luqman", ayahCount: 34 },
  { number: 32, name: "السجدة", englishName: "As-Sajdah", ayahCount: 30 },
  { number: 33, name: "الأحزاب", englishName: "Al-Ahzab", ayahCount: 73 },
  { number: 34, name: "سبأ", englishName: "Saba", ayahCount: 54 },
  { number: 35, name: "فاطر", englishName: "Fatir", ayahCount: 45 },
  { number: 36, name: "يس", englishName: "Ya-Sin", ayahCount: 83 },
  { number: 37, name: "الصافات", englishName: "As-Saffat", ayahCount: 182 },
  { number: 38, name: "ص", englishName: "Sad", ayahCount: 88 },
  { number: 39, name: "الزمر", englishName: "Az-Zumar", ayahCount: 75 },
  { number: 40, name: "غافر", englishName: "Ghafir", ayahCount: 85 },
  { number: 41, name: "فصلت", englishName: "Fussilat", ayahCount: 54 },
  { number: 42, name: "الشورى", englishName: "Ash-Shura", ayahCount: 53 },
  { number: 43, name: "الزخرف", englishName: "Az-Zukhruf", ayahCount: 89 },
  { number: 44, name: "الدخان", englishName: "Ad-Dukhan", ayahCount: 59 },
  { number: 45, name: "الجاثية", englishName: "Al-Jathiyah", ayahCount: 37 },
  { number: 46, name: "الأحقاف", englishName: "Al-Ahqaf", ayahCount: 35 },
  { number: 47, name: "محمد", englishName: "Muhammad", ayahCount: 38 },
  { number: 48, name: "الفتح", englishName: "Al-Fath", ayahCount: 29 },
  { number: 49, name: "الحجرات", englishName: "Al-Hujurat", ayahCount: 18 },
  { number: 50, name: "ق", englishName: "Qaf", ayahCount: 45 },
  { number: 51, name: "الذاريات", englishName: "Adh-Dhariyat", ayahCount: 60 },
  { number: 52, name: "الطور", englishName: "At-Tur", ayahCount: 49 },
  { number: 53, name: "النجم", englishName: "An-Najm", ayahCount: 62 },
  { number: 54, name: "القمر", englishName: "Al-Qamar", ayahCount: 55 },
  { number: 55, name: "الرحمن", englishName: "Ar-Rahman", ayahCount: 78 },
  { number: 56, name: "الواقعة", englishName: "Al-Waqi'ah", ayahCount: 96 },
  { number: 57, name: "الحديد", englishName: "Al-Hadid", ayahCount: 29 },
  { number: 58, name: "المجادلة", englishName: "Al-Mujadila", ayahCount: 22 },
  { number: 59, name: "الحشر", englishName: "Al-Hashr", ayahCount: 24 },
  { number: 60, name: "الممتحنة", englishName: "Al-Mumtahanah", ayahCount: 13 },
  { number: 61, name: "الصف", englishName: "As-Saff", ayahCount: 14 },
  { number: 62, name: "الجمعة", englishName: "Al-Jumu'ah", ayahCount: 11 },
  { number: 63, name: "المنافقون", englishName: "Al-Munafiqun", ayahCount: 11 },
  { number: 64, name: "التغابن", englishName: "At-Taghabun", ayahCount: 18 },
  { number: 65, name: "الطلاق", englishName: "At-Talaq", ayahCount: 12 },
  { number: 66, name: "التحريم", englishName: "At-Tahrim", ayahCount: 12 },
  { number: 67, name: "الملك", englishName: "Al-Mulk", ayahCount: 30 },
  { number: 68, name: "القلم", englishName: "Al-Qalam", ayahCount: 52 },
  { number: 69, name: "الحاقة", englishName: "Al-Haqqah", ayahCount: 52 },
  { number: 70, name: "المعارج", englishName: "Al-Ma'arij", ayahCount: 44 },
  { number: 71, name: "نوح", englishName: "Nuh", ayahCount: 28 },
  { number: 72, name: "الجن", englishName: "Al-Jinn", ayahCount: 28 },
  { number: 73, name: "المزمل", englishName: "Al-Muzzammil", ayahCount: 20 },
  { number: 74, name: "المدثر", englishName: "Al-Muddaththir", ayahCount: 56 },
  { number: 75, name: "القيامة", englishName: "Al-Qiyamah", ayahCount: 40 },
  { number: 76, name: "الإنسان", englishName: "Al-Insan", ayahCount: 31 },
  { number: 77, name: "المرسلات", englishName: "Al-Mursalat", ayahCount: 50 },
  { number: 78, name: "النبأ", englishName: "An-Naba", ayahCount: 40 },
  { number: 79, name: "النازعات", englishName: "An-Nazi'at", ayahCount: 46 },
  { number: 80, name: "عبس", englishName: "'Abasa", ayahCount: 42 },
  { number: 81, name: "التكوير", englishName: "At-Takwir", ayahCount: 29 },
  { number: 82, name: "الانفطار", englishName: "Al-Infitar", ayahCount: 19 },
  { number: 83, name: "المطففين", englishName: "Al-Mutaffifin", ayahCount: 36 },
  { number: 84, name: "الانشقاق", englishName: "Al-Inshiqaq", ayahCount: 25 },
  { number: 85, name: "البروج", englishName: "Al-Buruj", ayahCount: 22 },
  { number: 86, name: "الطارق", englishName: "At-Tariq", ayahCount: 17 },
  { number: 87, name: "الأعلى", englishName: "Al-A'la", ayahCount: 19 },
  { number: 88, name: "الغاشية", englishName: "Al-Ghashiyah", ayahCount: 26 },
  { number: 89, name: "الفجر", englishName: "Al-Fajr", ayahCount: 30 },
  { number: 90, name: "البلد", englishName: "Al-Balad", ayahCount: 20 },
  { number: 91, name: "الشمس", englishName: "Ash-Shams", ayahCount: 15 },
  { number: 92, name: "الليل", englishName: "Al-Layl", ayahCount: 21 },
  { number: 93, name: "الضحى", englishName: "Ad-Duha", ayahCount: 11 },
  { number: 94, name: "الشرح", englishName: "Ash-Sharh", ayahCount: 8 },
  { number: 95, name: "التين", englishName: "At-Tin", ayahCount: 8 },
  { number: 96, name: "العلق", englishName: "Al-'Alaq", ayahCount: 19 },
  { number: 97, name: "القدر", englishName: "Al-Qadr", ayahCount: 5 },
  { number: 98, name: "البينة", englishName: "Al-Bayyinah", ayahCount: 8 },
  { number: 99, name: "الزلزلة", englishName: "Az-Zalzalah", ayahCount: 8 },
  { number: 100, name: "العاديات", englishName: "Al-'Adiyat", ayahCount: 11 },
  { number: 101, name: "القارعة", englishName: "Al-Qari'ah", ayahCount: 11 },
  { number: 102, name: "التكاثر", englishName: "At-Takathur", ayahCount: 8 },
  { number: 103, name: "العصر", englishName: "Al-'Asr", ayahCount: 3 },
  { number: 104, name: "الهمزة", englishName: "Al-Humazah", ayahCount: 9 },
  { number: 105, name: "الفيل", englishName: "Al-Fil", ayahCount: 5 },
  { number: 106, name: "قريش", englishName: "Quraysh", ayahCount: 4 },
  { number: 107, name: "الماعون", englishName: "Al-Ma'un", ayahCount: 7 },
  { number: 108, name: "الكوثر", englishName: "Al-Kawthar", ayahCount: 3 },
  { number: 109, name: "الكافرون", englishName: "Al-Kafirun", ayahCount: 6 },
  { number: 110, name: "النصر", englishName: "An-Nasr", ayahCount: 3 },
  { number: 111, name: "المسد", englishName: "Al-Masad", ayahCount: 5 },
  { number: 112, name: "الإخلاص", englishName: "Al-Ikhlas", ayahCount: 4 },
  { number: 113, name: "الفلق", englishName: "Al-Falaq", ayahCount: 5 },
  { number: 114, name: "الناس", englishName: "An-Nas", ayahCount: 6 }
];

export interface JuzSurahSegment {
  surahNumber: number;
  ayahStart: number;
  ayahEnd: number;
}

export interface JuzData {
  juzNumber: number;
  arabicName: string;
  segments: JuzSurahSegment[];
}

export const JUZ_MAPPINGS: JuzData[] = [
  { juzNumber: 1, arabicName: "الم (Alif Lam Meem)", segments: [{ surahNumber: 1, ayahStart: 1, ayahEnd: 7 }, { surahNumber: 2, ayahStart: 1, ayahEnd: 141 }] },
  { juzNumber: 2, arabicName: "سيقول (Sayaqool)", segments: [{ surahNumber: 2, ayahStart: 142, ayahEnd: 252 }] },
  { juzNumber: 3, arabicName: "تلك الرسل (Tilka ar-Rusul)", segments: [{ surahNumber: 2, ayahStart: 253, ayahEnd: 286 }, { surahNumber: 3, ayahStart: 1, ayahEnd: 92 }] },
  { juzNumber: 4, arabicName: "لن تنالوا (Lan Tanaaloo)", segments: [{ surahNumber: 3, ayahStart: 93, ayahEnd: 200 }, { surahNumber: 4, ayahStart: 1, ayahEnd: 23 }] },
  { juzNumber: 5, arabicName: "والمحصنات (Wal-Muhsanat)", segments: [{ surahNumber: 4, ayahStart: 24, ayahEnd: 147 }] },
  { juzNumber: 6, arabicName: "لا يحب الله (La Yuhibbullah)", segments: [{ surahNumber: 4, ayahStart: 148, ayahEnd: 176 }, { surahNumber: 5, ayahStart: 1, ayahEnd: 81 }] },
  { juzNumber: 7, arabicName: "وإذا سمعوا (Wa Iza Sami'oo)", segments: [{ surahNumber: 5, ayahStart: 82, ayahEnd: 120 }, { surahNumber: 6, ayahStart: 1, ayahEnd: 110 }] },
  { juzNumber: 8, arabicName: "ولو أننا (Walaw Annana)", segments: [{ surahNumber: 6, ayahStart: 111, ayahEnd: 165 }, { surahNumber: 7, ayahStart: 1, ayahEnd: 87 }] },
  { juzNumber: 9, arabicName: "قال الملأ (Qalal-Mala'u)", segments: [{ surahNumber: 7, ayahStart: 88, ayahEnd: 206 }, { surahNumber: 8, ayahStart: 1, ayahEnd: 40 }] },
  { juzNumber: 10, arabicName: "واعلموا (Wa'lamoo)", segments: [{ surahNumber: 8, ayahStart: 41, ayahEnd: 75 }, { surahNumber: 9, ayahStart: 1, ayahEnd: 92 }] },
  { juzNumber: 11, arabicName: "يعتذرون (Ya'taziroon)", segments: [{ surahNumber: 9, ayahStart: 93, ayahEnd: 129 }, { surahNumber: 10, ayahStart: 1, ayahEnd: 109 }, { surahNumber: 11, ayahStart: 1, ayahEnd: 5 }] },
  { juzNumber: 12, arabicName: "وما من دابة (Wa Ma Min Dabbah)", segments: [{ surahNumber: 11, ayahStart: 6, ayahEnd: 123 }, { surahNumber: 12, ayahStart: 1, ayahEnd: 52 }] },
  { juzNumber: 13, arabicName: "وما أبرئ (Wa Ma Oobari'oo)", segments: [{ surahNumber: 12, ayahStart: 53, ayahEnd: 111 }, { surahNumber: 13, ayahStart: 1, ayahEnd: 43 }, { surahNumber: 14, ayahStart: 1, ayahEnd: 52 }] },
  { juzNumber: 14, arabicName: "ربما (Rubama)", segments: [{ surahNumber: 15, ayahStart: 1, ayahEnd: 99 }, { surahNumber: 16, ayahStart: 1, ayahEnd: 128 }] },
  { juzNumber: 15, arabicName: "سبحان الذي (Subhanallazi)", segments: [{ surahNumber: 17, ayahStart: 1, ayahEnd: 111 }, { surahNumber: 18, ayahStart: 1, ayahEnd: 74 }] },
  { juzNumber: 16, arabicName: "قال ألم (Qala Alam)", segments: [{ surahNumber: 18, ayahStart: 75, ayahEnd: 110 }, { surahNumber: 19, ayahStart: 1, ayahEnd: 98 }, { surahNumber: 20, ayahStart: 1, ayahEnd: 135 }] },
  { juzNumber: 17, arabicName: "اقترب للناس (Iqtaraba Lin-Naas)", segments: [{ surahNumber: 21, ayahStart: 1, ayahEnd: 112 }, { surahNumber: 22, ayahStart: 1, ayahEnd: 78 }] },
  { juzNumber: 18, arabicName: "قد أفلح (Qad Aflaha)", segments: [{ surahNumber: 23, ayahStart: 1, ayahEnd: 118 }, { surahNumber: 24, ayahStart: 1, ayahEnd: 64 }, { surahNumber: 25, ayahStart: 1, ayahEnd: 20 }] },
  { juzNumber: 19, arabicName: "وقال الذين (Wa Qalal-Lazeena)", segments: [{ surahNumber: 25, ayahStart: 21, ayahEnd: 77 }, { surahNumber: 26, ayahStart: 1, ayahEnd: 227 }, { surahNumber: 27, ayahStart: 1, ayahEnd: 55 }] },
  { juzNumber: 20, arabicName: "أمن خلق (Amman Khalaqa)", segments: [{ surahNumber: 27, ayahStart: 56, ayahEnd: 93 }, { surahNumber: 28, ayahStart: 1, ayahEnd: 88 }, { surahNumber: 29, ayahStart: 1, ayahEnd: 45 }] },
  { juzNumber: 21, arabicName: "اتل ما أوحي (Utlu Ma Oohiya)", segments: [{ surahNumber: 29, ayahStart: 46, ayahEnd: 69 }, { surahNumber: 30, ayahStart: 1, ayahEnd: 60 }, { surahNumber: 31, ayahStart: 1, ayahEnd: 34 }, { surahNumber: 32, ayahStart: 1, ayahEnd: 30 }, { surahNumber: 33, ayahStart: 1, ayahEnd: 30 }] },
  { juzNumber: 22, arabicName: "ومن يقنت (Wa Man Yaqnut)", segments: [{ surahNumber: 33, ayahStart: 31, ayahEnd: 73 }, { surahNumber: 34, ayahStart: 1, ayahEnd: 54 }, { surahNumber: 35, ayahStart: 1, ayahEnd: 45 }, { surahNumber: 36, ayahStart: 1, ayahEnd: 27 }] },
  { juzNumber: 23, arabicName: "وما أنزلنا (Wa Maliya)", segments: [{ surahNumber: 36, ayahStart: 28, ayahEnd: 83 }, { surahNumber: 37, ayahStart: 1, ayahEnd: 182 }, { surahNumber: 38, ayahStart: 1, ayahEnd: 88 }, { surahNumber: 39, ayahStart: 1, ayahEnd: 31 }] },
  { juzNumber: 24, arabicName: "فمن أظلم (Faman Azlamu)", segments: [{ surahNumber: 39, ayahStart: 32, ayahEnd: 75 }, { surahNumber: 40, ayahStart: 1, ayahEnd: 85 }, { surahNumber: 41, ayahStart: 1, ayahEnd: 46 }] },
  { juzNumber: 25, arabicName: "إليه يرد (Ilayhi Yuraddu)", segments: [{ surahNumber: 41, ayahStart: 47, ayahEnd: 54 }, { surahNumber: 42, ayahStart: 1, ayahEnd: 53 }, { surahNumber: 43, ayahStart: 1, ayahEnd: 89 }, { surahNumber: 44, ayahStart: 1, ayahEnd: 59 }, { surahNumber: 45, ayahStart: 1, ayahEnd: 37 }] },
  { juzNumber: 26, arabicName: "حم (Ha' Meem)", segments: [{ surahNumber: 46, ayahStart: 1, ayahEnd: 35 }, { surahNumber: 47, ayahStart: 1, ayahEnd: 38 }, { surahNumber: 48, ayahStart: 1, ayahEnd: 29 }, { surahNumber: 49, ayahStart: 1, ayahEnd: 18 }, { surahNumber: 50, ayahStart: 1, ayahEnd: 45 }, { surahNumber: 51, ayahStart: 1, ayahEnd: 30 }] },
  { juzNumber: 27, arabicName: "قال فما خطبكم (Qala Fama Khatbukum)", segments: [{ surahNumber: 51, ayahStart: 31, ayahEnd: 60 }, { surahNumber: 52, ayahStart: 1, ayahEnd: 49 }, { surahNumber: 53, ayahStart: 1, ayahEnd: 62 }, { surahNumber: 54, ayahStart: 1, ayahEnd: 55 }, { surahNumber: 55, ayahStart: 1, ayahEnd: 78 }, { surahNumber: 56, ayahStart: 1, ayahEnd: 96 }, { surahNumber: 57, ayahStart: 1, ayahEnd: 29 }] },
  { juzNumber: 28, arabicName: "قد سمع الله (Qad Sami'allah)", segments: [
    { surahNumber: 58, ayahStart: 1, ayahEnd: 22 },
    { surahNumber: 59, ayahStart: 1, ayahEnd: 24 },
    { surahNumber: 60, ayahStart: 1, ayahEnd: 13 },
    { surahNumber: 61, ayahStart: 1, ayahEnd: 14 },
    { surahNumber: 62, ayahStart: 1, ayahEnd: 11 },
    { surahNumber: 63, ayahStart: 1, ayahEnd: 11 },
    { surahNumber: 64, ayahStart: 1, ayahEnd: 18 },
    { surahNumber: 65, ayahStart: 1, ayahEnd: 12 },
    { surahNumber: 66, ayahStart: 1, ayahEnd: 12 }
  ]},
  { juzNumber: 29, arabicName: "تبارك الذي (Tabarakallazi)", segments: [
    { surahNumber: 67, ayahStart: 1, ayahEnd: 30 },
    { surahNumber: 68, ayahStart: 1, ayahEnd: 52 },
    { surahNumber: 69, ayahStart: 1, ayahEnd: 52 },
    { surahNumber: 70, ayahStart: 1, ayahEnd: 44 },
    { surahNumber: 71, ayahStart: 1, ayahEnd: 28 },
    { surahNumber: 72, ayahStart: 1, ayahEnd: 28 },
    { surahNumber: 73, ayahStart: 1, ayahEnd: 20 },
    { surahNumber: 74, ayahStart: 1, ayahEnd: 56 },
    { surahNumber: 75, ayahStart: 1, ayahEnd: 40 },
    { surahNumber: 76, ayahStart: 1, ayahEnd: 31 },
    { surahNumber: 77, ayahStart: 1, ayahEnd: 50 }
  ]},
  { juzNumber: 30, arabicName: "عم يتساءلون ('Amma Yatasa'aloon)", segments: [
    { surahNumber: 78, ayahStart: 1, ayahEnd: 40 },
    { surahNumber: 79, ayahStart: 1, ayahEnd: 46 },
    { surahNumber: 80, ayahStart: 1, ayahEnd: 42 },
    { surahNumber: 81, ayahStart: 1, ayahEnd: 29 },
    { surahNumber: 82, ayahStart: 1, ayahEnd: 19 },
    { surahNumber: 83, ayahStart: 1, ayahEnd: 36 },
    { surahNumber: 84, ayahStart: 1, ayahEnd: 25 },
    { surahNumber: 85, ayahStart: 1, ayahEnd: 22 },
    { surahNumber: 86, ayahStart: 1, ayahEnd: 17 },
    { surahNumber: 87, ayahStart: 1, ayahEnd: 19 },
    { surahNumber: 88, ayahStart: 1, ayahEnd: 26 },
    { surahNumber: 89, ayahStart: 1, ayahEnd: 30 },
    { surahNumber: 90, ayahStart: 1, ayahEnd: 20 },
    { surahNumber: 91, ayahStart: 1, ayahEnd: 15 },
    { surahNumber: 92, ayahStart: 1, ayahEnd: 21 },
    { surahNumber: 93, ayahStart: 1, ayahEnd: 11 },
    { surahNumber: 94, ayahStart: 1, ayahEnd: 8 },
    { surahNumber: 95, ayahStart: 1, ayahEnd: 8 },
    { surahNumber: 96, ayahStart: 1, ayahEnd: 19 },
    { surahNumber: 97, ayahStart: 1, ayahEnd: 5 },
    { surahNumber: 98, ayahStart: 1, ayahEnd: 8 },
    { surahNumber: 99, ayahStart: 1, ayahEnd: 8 },
    { surahNumber: 100, ayahStart: 1, ayahEnd: 11 },
    { surahNumber: 101, ayahStart: 1, ayahEnd: 11 },
    { surahNumber: 102, ayahStart: 1, ayahEnd: 8 },
    { surahNumber: 103, ayahStart: 1, ayahEnd: 3 },
    { surahNumber: 104, ayahStart: 1, ayahEnd: 9 },
    { surahNumber: 105, ayahStart: 1, ayahEnd: 5 },
    { surahNumber: 106, ayahStart: 1, ayahEnd: 4 },
    { surahNumber: 107, ayahStart: 1, ayahEnd: 7 },
    { surahNumber: 108, ayahStart: 1, ayahEnd: 3 },
    { surahNumber: 109, ayahStart: 1, ayahEnd: 6 },
    { surahNumber: 110, ayahStart: 1, ayahEnd: 3 },
    { surahNumber: 111, ayahStart: 1, ayahEnd: 5 },
    { surahNumber: 112, ayahStart: 1, ayahEnd: 4 },
    { surahNumber: 113, ayahStart: 1, ayahEnd: 5 },
    { surahNumber: 114, ayahStart: 1, ayahEnd: 6 }
  ]}
];

/**
 * Returns list of surahs that exist within a specific Juz
 */
export function getSurahsForJuz(juzNumber: number): SurahMeta[] {
  const juz = JUZ_MAPPINGS.find(j => j.juzNumber === juzNumber);
  if (!juz) return [];
  const surahNumbers = juz.segments.map(s => s.surahNumber);
  return SURAH_LIST.filter(s => surahNumbers.includes(s.number));
}

/**
 * Returns allowed ayah range for a given surah within a given juz
 */
export function getAyahRangeForSurahInJuz(juzNumber: number, surahNumber: number): { min: number; max: number } | null {
  const juz = JUZ_MAPPINGS.find(j => j.juzNumber === juzNumber);
  if (!juz) return null;
  const segment = juz.segments.find(s => s.surahNumber === surahNumber);
  if (!segment) return null;
  return { min: segment.ayahStart, max: segment.ayahEnd };
}

/**
 * Validates whether the Juz -> Surah -> Ayah selection is mathematically and canonically valid.
 */
export function validateQuranSelection(
  juzNumber: number,
  surahNumber: number,
  ayahStart: number,
  ayahEnd: number
): { valid: boolean; error?: string } {
  if (juzNumber < 1 || juzNumber > 30) {
    return { valid: false, error: "Juz number must be between 1 and 30" };
  }

  const surah = SURAH_LIST.find(s => s.number === surahNumber);
  if (!surah) {
    return { valid: false, error: `Surah #${surahNumber} not found` };
  }

  const range = getAyahRangeForSurahInJuz(juzNumber, surahNumber);
  if (!range) {
    return { valid: false, error: `Surah ${surah.englishName} does not belong to Juz ${juzNumber}` };
  }

  if (ayahStart < range.min || ayahStart > range.max) {
    return { 
      valid: false, 
      error: `Start Ayah ${ayahStart} is out of bounds for Juz ${juzNumber}. Valid range is ${range.min} to ${range.max}` 
    };
  }

  if (ayahEnd < ayahStart || ayahEnd > range.max) {
    return { 
      valid: false, 
      error: `End Ayah ${ayahEnd} is invalid. It must be between ${ayahStart} and ${range.max}` 
    };
  }

  return { valid: true };
}
