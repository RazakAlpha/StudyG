export type KhayaLanguage = {
  name: string;
  ttsCode: string;
  translationCode?: string; // en -> target, only for supported languages
};

// All languages supported by the Khaya AI TTS API.
// `translationCode` is set only for languages that also support text translation.
// Sorted: translated languages first (more capable), then TTS-only.
export const KHAYA_LANGUAGES: KhayaLanguage[] = [
  // --- Languages with both Translation + TTS support ---
  { name: "Asante Twi", ttsCode: "twi", translationCode: "tw" },
  { name: "Ewe", ttsCode: "ewe", translationCode: "ee" },
  { name: "Ga", ttsCode: "gaa", translationCode: "gaa" },
  { name: "Fante", ttsCode: "fat", translationCode: "fat" },
  { name: "Yoruba", ttsCode: "yor", translationCode: "yo" },
  { name: "Dagbani", ttsCode: "dag", translationCode: "dag" },
  { name: "Kikuyu", ttsCode: "kik", translationCode: "ki" },
  { name: "Gurene", ttsCode: "gur", translationCode: "gur" },
  { name: "Luo", ttsCode: "luo", translationCode: "luo" },
  { name: "Meru/Kimeru", ttsCode: "mer", translationCode: "mer" },
  { name: "Kusaal", ttsCode: "kus", translationCode: "kus" },
  // --- TTS-only languages ---
  { name: "Akuapem Twi", ttsCode: "atw" },
  { name: "Adangme", ttsCode: "ada" },
  { name: "Dagaare", ttsCode: "dga" },
  { name: "French", ttsCode: "fra" },
  { name: "Gonja", ttsCode: "gjn" },
  { name: "Hausa", ttsCode: "hau" },
  { name: "Igbo", ttsCode: "ibo" },
  { name: "Kasem", ttsCode: "xsm" },
  { name: "Konkomba (Likpakpaanl)", ttsCode: "xon" },
  { name: "Konkomba (Likoonli)", ttsCode: "lxn" },
  { name: "Krio", ttsCode: "kri" },
  { name: "Mampruli", ttsCode: "maw" },
  { name: "Mende", ttsCode: "men" },
  { name: "Nzema", ttsCode: "nzi" },
  { name: "Pidgin", ttsCode: "pcm" },
  { name: "Shona", ttsCode: "sna" },
  { name: "Swahili", ttsCode: "swa" },
  { name: "Temne", ttsCode: "tem" },
  { name: "Wali", ttsCode: "wlx" },
  { name: "Wolof", ttsCode: "wol" },
];

export const KHAYA_SPEAKERS = [
  { id: "female", label: "Female" },
  { id: "male_low", label: "Male (Low)" },
  { id: "male_high", label: "Male (High)" },
] as const;

export type KhayaSpeakerId = (typeof KHAYA_SPEAKERS)[number]["id"];

export function getLanguageByTtsCode(ttsCode: string): KhayaLanguage | undefined {
  return KHAYA_LANGUAGES.find((l) => l.ttsCode === ttsCode);
}
