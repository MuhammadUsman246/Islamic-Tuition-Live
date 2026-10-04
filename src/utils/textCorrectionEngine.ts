/**
 * Lightweight, 100% Client-Side Smart Text Correction Engine
 * Designed specifically for Islamic Tuition LMS Lesson Reporting.
 * 
 * ZERO AI - ZERO External APIs - ZERO Keystroke Network Overhead.
 * Conservative, rule-based correction with Protected Islamic/Quranic Terminology.
 */

export type CorrectionType = 'spelling' | 'phrase' | 'formatting' | 'capitalization' | 'protected' | 'review';
export type DictionaryStatus = 'verified' | 'suggested_review' | 'disabled';

export interface DictionaryEntry {
  id: string;
  wrong: string;
  correct: string;
  type: CorrectionType;
  category: 'Spelling' | 'Phrase' | 'Formatting' | 'Capitalization' | 'Quran' | 'Qaida' | 'Dua' | 'Kalma' | 'Salah' | 'Adaab' | 'Islamic Studies' | 'Common';
  confidence: 'high' | 'medium' | 'low';
  status: DictionaryStatus;
  notes?: string;
}

export interface ProtectedTermEntry {
  id: string;
  term: string;
  category: 'Quran' | 'Qaida' | 'Dua' | 'Islamic Studies' | 'Arabic / Tajweed';
  description?: string;
}

export interface CorrectionSuggestion {
  originalText: string;
  suggestedText: string;
  hasChanges: boolean;
  appliedRulesCount: number;
  explanations: string[];
}

// 1. INITIAL HIGH-CONFIDENCE VERIFIED SPELLING DICTIONARY
export const INITIAL_VERIFIED_SPELLING_RULES: DictionaryEntry[] = [
  { id: 'sp_1', wrong: 'etting', correct: 'eating', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_2', wrong: 'ettin', correct: 'eating', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_3', wrong: 'entring', correct: 'entering', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_4', wrong: 'toilts', correct: 'toilets', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_5', wrong: 'toilt', correct: 'toilet', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_6', wrong: 'parants', correct: 'parents', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_7', wrong: 'befor', correct: 'before', type: 'spelling', category: 'Common', confidence: 'high', status: 'verified' },
  { id: 'sp_8', wrong: 'neigbours', correct: 'neighbours', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_9', wrong: 'neigbour', correct: 'neighbour', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_10', wrong: 'complitly', correct: 'completely', type: 'spelling', category: 'Common', confidence: 'high', status: 'verified' },
  { id: 'sp_11', wrong: 'learnig', correct: 'learning', type: 'spelling', category: 'Common', confidence: 'high', status: 'verified' },
  { id: 'sp_12', wrong: 'recitin', correct: 'reciting', type: 'spelling', category: 'Quran', confidence: 'high', status: 'verified' },
  { id: 'sp_13', wrong: 'memorizng', correct: 'memorizing', type: 'spelling', category: 'Quran', confidence: 'high', status: 'verified' },
  { id: 'sp_14', wrong: 'revison', correct: 'revision', type: 'spelling', category: 'Common', confidence: 'high', status: 'verified' },
  { id: 'sp_15', wrong: 'mornin', correct: 'morning', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_16', wrong: 'evning', correct: 'evening', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_17', wrong: 'sleping', correct: 'sleeping', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_18', wrong: 'sleepin', correct: 'sleeping', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_19', wrong: 'drining', correct: 'drinking', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_20', wrong: 'drinkin', correct: 'drinking', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_21', wrong: 'sneezeing', correct: 'sneezing', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_22', wrong: 'sneezin', correct: 'sneezing', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_23', wrong: 'cloths', correct: 'clothes', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_24', wrong: 'clotheing', correct: 'clothing', type: 'spelling', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'sp_25', wrong: 'bismilah', correct: 'Bismillah', type: 'spelling', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'sp_26', wrong: 'alhamdullilah', correct: 'Alhamdulillah', type: 'spelling', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'sp_27', wrong: 'alhamdulillah', correct: 'Alhamdulillah', type: 'spelling', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'sp_28', wrong: 'jazakallah', correct: 'JazakAllah', type: 'spelling', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'sp_29', wrong: 'subhanallah', correct: 'SubhanAllah', type: 'spelling', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'sp_30', wrong: 'inshallah', correct: 'InshaAllah', type: 'spelling', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'sp_31', wrong: 'mashallah', correct: 'MashaAllah', type: 'spelling', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'sp_32', wrong: 'astaghfirullah', correct: 'Astaghfirullah', type: 'spelling', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'sp_33', wrong: 'practis', correct: 'practice', type: 'spelling', category: 'Common', confidence: 'high', status: 'verified' },
  { id: 'sp_34', wrong: 'practise', correct: 'practice', type: 'spelling', category: 'Common', confidence: 'high', status: 'verified' },
  { id: 'sp_35', wrong: 'pronounciation', correct: 'pronunciation', type: 'spelling', category: 'Common', confidence: 'high', status: 'verified' },
  { id: 'sp_36', wrong: 'exersice', correct: 'exercise', type: 'spelling', category: 'Qaida', confidence: 'high', status: 'verified' },
  { id: 'sp_37', wrong: 'exrecise', correct: 'exercise', type: 'spelling', category: 'Qaida', confidence: 'high', status: 'verified' },
  { id: 'sp_38', wrong: 'leters', correct: 'letters', type: 'spelling', category: 'Qaida', confidence: 'high', status: 'verified' },
  { id: 'sp_39', wrong: 'alphabets', correct: 'alphabets', type: 'spelling', category: 'Qaida', confidence: 'high', status: 'verified' }
];

// 2. INITIAL HIGH-CONFIDENCE PHRASE DICTIONARY
export const INITIAL_VERIFIED_PHRASE_RULES: DictionaryEntry[] = [
  { id: 'ph_1', wrong: 'after etting dua', correct: 'After eating dua', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_2', wrong: 'after ettin dua', correct: 'After eating dua', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_3', wrong: 'after eating dua', correct: 'After eating dua', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_4', wrong: 'before etting dua', correct: 'Before eating dua', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_5', wrong: 'before ettin dua', correct: 'Before eating dua', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_6', wrong: 'before eating dua', correct: 'Before eating dua', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_7', wrong: 'about neigbours', correct: 'About neighbours', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_8', wrong: 'about neighbours', correct: 'About neighbours', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_9', wrong: 'about neighbors', correct: 'About neighbours', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_10', wrong: 'respect our brother and sister', correct: 'Respect our brothers and sisters', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_11', wrong: 'respect our brother and sisters', correct: 'Respect our brothers and sisters', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_12', wrong: 'respect brother and sister', correct: 'Respect brothers and sisters', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_13', wrong: 'drink milking', correct: 'Drinking milk', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_14', wrong: 'drinking milking', correct: 'Drinking milk', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_15', wrong: 'drink milk dua', correct: 'Dua for drinking milk', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_16', wrong: 'sunnah of water', correct: 'Sunnah of drinking water', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_17', wrong: 'sunnah of drinking water', correct: 'Sunnah of drinking water', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_18', wrong: 'sunnah of eating', correct: 'Sunnah of eating', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_19', wrong: 'sunnah of sleeping', correct: 'Sunnah of sleeping', type: 'phrase', category: 'Adaab', confidence: 'high', status: 'verified' },
  { id: 'ph_20', wrong: 'before sleeping dua', correct: 'Before sleeping dua', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_21', wrong: 'after waking up dua', correct: 'After waking up dua', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_22', wrong: 'entering toilet dua', correct: 'Dua for entering toilet', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_23', wrong: 'leaving toilet dua', correct: 'Dua for leaving toilet', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_24', wrong: 'entering house dua', correct: 'Dua for entering house', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_25', wrong: 'leaving house dua', correct: 'Dua for leaving house', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_26', wrong: 'dua for travelling', correct: 'Dua for travelling', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_27', wrong: 'dua for traveling', correct: 'Dua for travelling', type: 'phrase', category: 'Dua', confidence: 'high', status: 'verified' },
  { id: 'ph_28', wrong: 'first kalma', correct: '1st Kalma (Tayyab)', type: 'phrase', category: 'Kalma', confidence: 'high', status: 'verified' },
  { id: 'ph_29', wrong: 'second kalma', correct: '2nd Kalma (Shahadat)', type: 'phrase', category: 'Kalma', confidence: 'high', status: 'verified' },
  { id: 'ph_30', wrong: 'third kalma', correct: '3rd Kalma (Tamjeed)', type: 'phrase', category: 'Kalma', confidence: 'high', status: 'verified' },
  { id: 'ph_31', wrong: 'fourth kalma', correct: '4th Kalma (Tawheed)', type: 'phrase', category: 'Kalma', confidence: 'high', status: 'verified' },
  { id: 'ph_32', wrong: 'fifth kalma', correct: '5th Kalma (Astaghfar)', type: 'phrase', category: 'Kalma', confidence: 'high', status: 'verified' },
  { id: 'ph_33', wrong: 'sixth kalma', correct: '6th Kalma (Radde Kufr)', type: 'phrase', category: 'Kalma', confidence: 'high', status: 'verified' },
  { id: 'ph_34', wrong: 'dua e qunoot', correct: 'Dua e Qunoot', type: 'phrase', category: 'Salah', confidence: 'high', status: 'verified' },
  { id: 'ph_35', wrong: 'dua qunoot', correct: 'Dua e Qunoot', type: 'phrase', category: 'Salah', confidence: 'high', status: 'verified' },
  { id: 'ph_36', wrong: 'attahiyyat', correct: 'Attahiyyat (Tashahhud)', type: 'phrase', category: 'Salah', confidence: 'high', status: 'verified' },
  { id: 'ph_37', wrong: 'durood e ibrahim', correct: 'Durood-e-Ibrahim', type: 'phrase', category: 'Salah', confidence: 'high', status: 'verified' },
  { id: 'ph_38', wrong: 'durood ibrahim', correct: 'Durood-e-Ibrahim', type: 'phrase', category: 'Salah', confidence: 'high', status: 'verified' },
  { id: 'ph_39', wrong: 'steps of salah', correct: 'Steps of Salah & Namaz', type: 'phrase', category: 'Salah', confidence: 'high', status: 'verified' },
  { id: 'ph_40', wrong: 'steps of wudhu', correct: 'Steps of Wudhu', type: 'phrase', category: 'Salah', confidence: 'high', status: 'verified' },
  { id: 'ph_41', wrong: 'steps of wudu', correct: 'Steps of Wudhu', type: 'phrase', category: 'Salah', confidence: 'high', status: 'verified' }
];

// 3. PROTECTED ISLAMIC & QURANIC TERMS (NEVER AGGRESSIVELY CORRUPTED OR OVER-CORRECTED)
export const PROTECTED_ACADEMY_TERMS: ProtectedTermEntry[] = [
  { id: 'prot_1', term: 'Quran', category: 'Quran', description: 'Holy Book of Allah' },
  { id: 'prot_2', term: 'Qaida', category: 'Qaida', description: 'Beginner Primer (Noorani / Madani)' },
  { id: 'prot_3', term: 'Juz', category: 'Quran', description: 'Para / Part of Quran (1-30)' },
  { id: 'prot_4', term: 'Surah', category: 'Quran', description: 'Chapter of the Holy Quran' },
  { id: 'prot_5', term: 'Ayah', category: 'Quran', description: 'Verse of the Holy Quran' },
  { id: 'prot_6', term: 'Ayahs', category: 'Quran', description: 'Verses plural' },
  { id: 'prot_7', term: 'Ayat', category: 'Quran', description: 'Alternative spelling for Ayah' },
  { id: 'prot_8', term: 'Kalma', category: 'Islamic Studies', description: 'Pillars of Faith (1st to 6th Kalma)' },
  { id: 'prot_9', term: 'Kalima', category: 'Islamic Studies', description: 'Alternative transliteration of Kalma' },
  { id: 'prot_10', term: 'Dua', category: 'Dua', description: 'Supplication / Prayer' },
  { id: 'prot_11', term: 'Duas', category: 'Dua', description: 'Supplications plural' },
  { id: 'prot_12', term: 'Salah', category: 'Islamic Studies', description: 'Daily Obligatory Prayer' },
  { id: 'prot_13', term: 'Namaz', category: 'Islamic Studies', description: 'Persian/Urdu term for Salah' },
  { id: 'prot_14', term: 'Adaab', category: 'Islamic Studies', description: 'Islamic Etiquettes & Manners' },
  { id: 'prot_15', term: 'Adab', category: 'Islamic Studies', description: 'Singular etiquette' },
  { id: 'prot_16', term: 'Akhlaaq', category: 'Islamic Studies', description: 'Moral character and virtue' },
  { id: 'prot_17', term: 'Sunnah', category: 'Islamic Studies', description: 'Tradition of Prophet Muhammad (PBUH)' },
  { id: 'prot_18', term: 'Hadith', category: 'Islamic Studies', description: 'Prophetic saying' },
  { id: 'prot_19', term: 'Hadees', category: 'Islamic Studies', description: 'Alternative transliteration of Hadith' },
  { id: 'prot_20', term: 'Ahadith', category: 'Islamic Studies', description: 'Plural of Hadith' },
  { id: 'prot_21', term: 'Pesh', category: 'Arabic / Tajweed', description: 'Dammah / U sound vowel in Urdu' },
  { id: 'prot_22', term: 'Dammah', category: 'Arabic / Tajweed', description: 'Arabic vowel mark' },
  { id: 'prot_23', term: 'Zabar', category: 'Arabic / Tajweed', description: 'Fathah / A sound vowel in Urdu' },
  { id: 'prot_24', term: 'Fathah', category: 'Arabic / Tajweed', description: 'Arabic vowel mark' },
  { id: 'prot_25', term: 'Zer', category: 'Arabic / Tajweed', description: 'Kasrah / I sound vowel in Urdu' },
  { id: 'prot_26', term: 'Kasrah', category: 'Arabic / Tajweed', description: 'Arabic vowel mark' },
  { id: 'prot_27', term: 'Tanween', category: 'Arabic / Tajweed', description: 'Double vowel nunation' },
  { id: 'prot_28', term: 'Sukoon', category: 'Arabic / Tajweed', description: 'Jazm resting vowelless mark' },
  { id: 'prot_29', term: 'Jazm', category: 'Arabic / Tajweed', description: 'Urdu term for Sukoon' },
  { id: 'prot_30', term: 'Shaddah', category: 'Arabic / Tajweed', description: 'Doubling consonant mark' },
  { id: 'prot_31', term: 'Tashdeed', category: 'Arabic / Tajweed', description: 'Urdu term for Shaddah' },
  { id: 'prot_32', term: 'Tajweed', category: 'Arabic / Tajweed', description: 'Rules of Quranic pronunciation' },
  { id: 'prot_33', term: 'Makharij', category: 'Arabic / Tajweed', description: 'Points of articulation for Arabic letters' },
  { id: 'prot_34', term: 'Madd', category: 'Arabic / Tajweed', description: 'Elongation rules in recitation' },
  { id: 'prot_35', term: 'Ghunnah', category: 'Arabic / Tajweed', description: 'Nasal sound duration' },
  { id: 'prot_36', term: 'Qalqalah', category: 'Arabic / Tajweed', description: 'Echoing sound on specific letters' },
  { id: 'prot_37', term: 'Ikhfa', category: 'Arabic / Tajweed', description: 'Hiding rule for Nun Sakin' },
  { id: 'prot_38', term: 'Idgham', category: 'Arabic / Tajweed', description: 'Merging rule for Nun Sakin' },
  { id: 'prot_39', term: 'Iqlab', category: 'Arabic / Tajweed', description: 'Conversion rule for Nun Sakin' },
  { id: 'prot_40', term: 'Izhar', category: 'Arabic / Tajweed', description: 'Clear pronunciation rule for Nun Sakin' },
  { id: 'prot_41', term: 'Sabaq', category: 'Quran', description: 'Daily new lesson portion' },
  { id: 'prot_42', term: 'Sabqi', category: 'Quran', description: 'Recent revisions portion' },
  { id: 'prot_43', term: 'Manzil', category: 'Quran', description: 'Older memorized revision portion' },
  { id: 'prot_44', term: 'Nazra', category: 'Quran', description: 'Reading Quran by looking at text' },
  { id: 'prot_45', term: 'Hifz', category: 'Quran', description: 'Full Quran memorization program' },
  { id: 'prot_46', term: 'Tafseer', category: 'Islamic Studies', description: 'Quranic commentary and explanation' },
  { id: 'prot_47', term: 'Allah', category: 'Islamic Studies', description: 'The One God' },
  { id: 'prot_48', term: 'Prophet', category: 'Islamic Studies', description: 'Messenger of Allah' },
  { id: 'prot_49', term: 'Bismillah', category: 'Dua', description: 'In the name of Allah' },
  { id: 'prot_50', term: 'Alhamdulillah', category: 'Dua', description: 'All praise is due to Allah' }
];

// 4. UNCERTAIN / SUGGESTED ENTRIES QUEUED FOR ADMIN REVIEW
export const INITIAL_SUGGESTED_REVIEW_RULES: DictionaryEntry[] = [
  { id: 'rev_1', wrong: 'salipingmunner', correct: 'Sunnah of sleeping / Sleeping manners', type: 'review', category: 'Adaab', confidence: 'low', status: 'suggested_review', notes: 'Appeared in lesson logs; needs admin review to determine if Sleeping Manners was intended' },
  { id: 'rev_2', wrong: 'watrdrinik', correct: 'Drinking water manners', type: 'review', category: 'Adaab', confidence: 'low', status: 'suggested_review', notes: 'Ambiguous typing abbreviation' },
  { id: 'rev_3', wrong: 'ettindua', correct: 'After eating dua', type: 'review', category: 'Dua', confidence: 'medium', status: 'suggested_review', notes: 'Joined words' },
  { id: 'rev_4', wrong: 'quranlessonrev', correct: 'Quran lesson revision', type: 'review', category: 'Quran', confidence: 'low', status: 'suggested_review', notes: 'Abbreviated shorthand' }
];

// Storage keys for custom Admin entries
const STORAGE_CUSTOM_DICTIONARY_KEY = 'it_custom_lesson_dictionary_v1';
const STORAGE_CUSTOM_PROTECTED_KEY = 'it_custom_protected_terms_v1';

/**
 * Loads the active dictionary (Built-in + Admin custom rules saved locally)
 */
export function getActiveDictionary(): {
  spellingRules: DictionaryEntry[];
  phraseRules: DictionaryEntry[];
  reviewRules: DictionaryEntry[];
  protectedTerms: ProtectedTermEntry[];
} {
  let customEntries: DictionaryEntry[] = [];
  let customProtected: ProtectedTermEntry[] = [];

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_CUSTOM_DICTIONARY_KEY);
      if (stored) customEntries = JSON.parse(stored);
      const storedProt = localStorage.getItem(STORAGE_CUSTOM_PROTECTED_KEY);
      if (storedProt) customProtected = JSON.parse(storedProt);
    } catch (e) {
      console.warn('[TextCorrectionEngine] Local storage load notice:', e);
    }
  }

  const allEntries = [
    ...INITIAL_VERIFIED_SPELLING_RULES,
    ...INITIAL_VERIFIED_PHRASE_RULES,
    ...INITIAL_SUGGESTED_REVIEW_RULES,
    ...customEntries
  ];

  const allProtected = [
    ...PROTECTED_ACADEMY_TERMS,
    ...customProtected
  ];

  const spellingRules = allEntries.filter(e => e.type === 'spelling' && e.status === 'verified');
  const phraseRules = allEntries.filter(e => e.type === 'phrase' && e.status === 'verified');
  const reviewRules = allEntries.filter(e => e.status === 'suggested_review');

  return {
    spellingRules,
    phraseRules,
    reviewRules,
    protectedTerms: allProtected
  };
}

/**
 * Saves updated custom dictionary entries to local storage
 */
export function saveCustomDictionary(entries: DictionaryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_CUSTOM_DICTIONARY_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('[TextCorrectionEngine] Failed to save custom dictionary:', e);
  }
}

/**
 * Saves updated protected terms to local storage
 */
export function saveCustomProtectedTerms(terms: ProtectedTermEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_CUSTOM_PROTECTED_KEY, JSON.stringify(terms));
  } catch (e) {
    console.error('[TextCorrectionEngine] Failed to save custom protected terms:', e);
  }
}

/**
 * Normalizes all-caps words while protecting acronyms / terminology
 */
function normalizeCapsWord(word: string, protectedMap: Set<string>): string {
  if (word.length <= 1) return word;

  // Check if word is all uppercase
  if (word === word.toUpperCase() && !/^\d+$/.test(word)) {
    // Check if it's protected exact term
    const lower = word.toLowerCase();
    if (protectedMap.has(lower)) {
      // Find original capitalization in protected list
      const matched = PROTECTED_ACADEMY_TERMS.find(p => p.term.toLowerCase() === lower);
      if (matched) return matched.term;
    }
    // Standard words: MEMORIZATION -> Memorization, TEST -> Test, NO -> No
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  return word;
}

/**
 * Clean up common punctuation and repeated space/dash formatting issues:
 * - `page page no-----11` -> `Page No. 11`
 * - `page no----511` -> `Page No. 511`
 * - `word  word` -> `word word`
 * - `word , next` -> `word, next`
 */
export function cleanFormatting(input: string): { cleaned: string; changed: boolean } {
  if (!input) return { cleaned: '', changed: false };

  let text = input;
  const original = input;

  // 1. Normalize multiple dashes or repeated dashes after "page no", "lesson", etc.
  // e.g. "page page no-----11" -> "page no. 11" or "page no. 11"
  text = text.replace(/page\s+page\s+no[\s\.\-]+(\d+)/gi, 'Page No. $1');
  text = text.replace(/page\s+no[\s\.\-]+(\d+)/gi, 'Page No. $1');
  text = text.replace(/pg\s+no[\s\.\-]+(\d+)/gi, 'Page No. $1');
  text = text.replace(/lesson\s+no[\s\.\-]+(\d+)/gi, 'Lesson No. $1');

  // 2. Remove accidental duplicate identical words: "page page" -> "Page", "the the" -> "the"
  // (Excluding legitimate repetitive words like "Alhamdulillah Alhamdulillah")
  text = text.replace(/\b(page|lesson|ayah|surah|juz|para|the|in|at|on)\s+\1\b/gi, (match, word) => {
    // Preserve initial capitalization
    return match.charAt(0) === match.charAt(0).toUpperCase()
      ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      : word.toLowerCase();
  });

  // 3. Clean up multiple excessive dashes/dots: "---" -> "-"
  text = text.replace(/\-{2,}/g, ' - ');
  text = text.replace(/\.{4,}/g, '...');

  // 4. Clean up spaces before commas, periods, colons
  text = text.replace(/\s+([,\.\:;\?!])/g, '$1 ');

  // 5. Clean up multiple spaces
  text = text.replace(/[ \t]{2,}/g, ' ');

  // 6. Trim edges
  text = text.trim();

  return {
    cleaned: text,
    changed: text !== original
  };
}

/**
 * Main Smart Text Correction Evaluator
 * Takes raw input text and returns conservative, high-confidence suggested corrections.
 */
export function evaluateTextCorrection(rawText: string): CorrectionSuggestion {
  if (!rawText || !rawText.trim()) {
    return {
      originalText: rawText,
      suggestedText: rawText,
      hasChanges: false,
      appliedRulesCount: 0,
      explanations: []
    };
  }

  const { spellingRules, phraseRules, protectedTerms } = getActiveDictionary();
  const protectedSet = new Set(protectedTerms.map(p => p.term.toLowerCase()));

  let modified = rawText;
  const explanations: string[] = [];
  let appliedRulesCount = 0;

  // ----------------------------------------------------
  // STEP 1: FORMATTING CLEANUP (Dashes, repeated words, spaces)
  // ----------------------------------------------------
  const formatRes = cleanFormatting(modified);
  if (formatRes.changed) {
    modified = formatRes.cleaned;
    appliedRulesCount++;
    explanations.push('Standardized spacing, repeated words, and dash formatting');
  }

  // ----------------------------------------------------
  // STEP 2: HIGH-CONFIDENCE PHRASE REPLACEMENT
  // ----------------------------------------------------
  for (const phraseRule of phraseRules) {
    const wrongPhrase = phraseRule.wrong.trim();
    if (!wrongPhrase) continue;

    // Word boundary case-insensitive regex
    const escaped = wrongPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s|[,\\.\\:;])${escaped}(\\s|[,\\.\\:;]|$)`, 'gi');

    if (regex.test(modified)) {
      modified = modified.replace(regex, (match, p1, p2) => {
        appliedRulesCount++;
        explanations.push(`Corrected phrase: "${wrongPhrase}" → "${phraseRule.correct}"`);
        return `${p1}${phraseRule.correct}${p2}`;
      });
    }
  }

  // ----------------------------------------------------
  // STEP 3: WORD-LEVEL SPELLING CORRECTIONS
  // ----------------------------------------------------
  // Split into tokens while preserving separators
  const words = modified.split(/(\s+|[,\.\:;\?!\(\)\-\/])/);

  const correctedWords = words.map(token => {
    // If token is whitespace or punctuation, preserve
    if (/^[\s,\.\:;\?!\(\)\-\/]+$/.test(token) || !token.trim()) {
      return token;
    }

    const cleanWord = token.trim();
    const cleanWordLower = cleanWord.toLowerCase();

    // Check if token is protected terminology -> preserve exactly
    if (protectedSet.has(cleanWordLower)) {
      // If it is in protected list and typed in all-caps or all-lower, normalize to standard title case
      const prot = protectedTerms.find(p => p.term.toLowerCase() === cleanWordLower);
      if (prot && (cleanWord === cleanWord.toUpperCase() || cleanWord === cleanWord.toLowerCase())) {
        if (cleanWord !== prot.term) {
          appliedRulesCount++;
          explanations.push(`Preserved religious term: "${cleanWord}" → "${prot.term}"`);
          return prot.term;
        }
      }
      return token;
    }

    // Check spelling dictionary
    const matchRule = spellingRules.find(r => r.wrong.toLowerCase() === cleanWordLower);
    if (matchRule) {
      appliedRulesCount++;
      explanations.push(`Corrected spelling: "${cleanWord}" → "${matchRule.correct}"`);
      // Maintain initial capital if original was capitalized
      if (cleanWord.charAt(0) === cleanWord.charAt(0).toUpperCase()) {
        return matchRule.correct.charAt(0).toUpperCase() + matchRule.correct.slice(1);
      }
      return matchRule.correct;
    }

    // Check all-caps normalization: MEMORIZATION -> Memorization, NO -> No, TEST -> Test
    if (cleanWord.length >= 2 && cleanWord === cleanWord.toUpperCase() && !/^\d+$/.test(cleanWord)) {
      const normalized = normalizeCapsWord(cleanWord, protectedSet);
      if (normalized !== cleanWord) {
        appliedRulesCount++;
        explanations.push(`Normalized capitalization: "${cleanWord}" → "${normalized}"`);
        return normalized;
      }
    }

    return token;
  });

  modified = correctedWords.join('');

  // ----------------------------------------------------
  // STEP 4: FIRST LETTER SENTENCE CAPITALIZATION
  // ----------------------------------------------------
  // If text starts with lowercase letter and isn't a special citation or number, capitalize first letter
  if (modified.length > 0 && /^[a-z]/.test(modified)) {
    modified = modified.charAt(0).toUpperCase() + modified.slice(1);
  }

  // Clean final spaces
  modified = modified.replace(/[ \t]{2,}/g, ' ').trim();

  const hasChanges = modified !== rawText.trim();

  return {
    originalText: rawText,
    suggestedText: modified,
    hasChanges,
    appliedRulesCount,
    explanations: Array.from(new Set(explanations))
  };
}
