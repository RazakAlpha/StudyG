import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { authComponent } from "./betterAuth/auth";

// Explicit return type of api.ai.quickLearnTopic to break the TS circularity
// that occurs when ctx.runAction references another action's return value.
type QuickLearnResult = {
  lesson: {
    title: string;
    keyPoints: string[];
    explanation: string;
  };
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }>;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KHAYA_API_BASE = "https://translation-api.ghananlp.org";

// Maps Khaya TTS language codes to Khaya Translation API language codes.
// Only TTS codes that have a corresponding translation code are listed here.
const TRANSLATION_SUPPORT: Record<string, string> = {
  twi: "tw",   // Asante Twi
  ewe: "ee",   // Ewe
  gaa: "gaa",  // Ga
  fat: "fat",  // Fante
  yor: "yo",   // Yoruba
  dag: "dag",  // Dagbani
  kik: "ki",   // Kikuyu
  gur: "gur",  // Gurene
  luo: "luo",  // Luo
  mer: "mer",  // Meru/Kimeru
  kus: "kus",  // Kusaal
};

// Maps TTS codes to human-readable display names.
const TTS_CODE_TO_NAME: Record<string, string> = {
  ada: "Adangme",
  atw: "Akuapem Twi",
  twi: "Asante Twi",
  dag: "Dagbani",
  dga: "Dagaare",
  ewe: "Ewe",
  fat: "Fante",
  fra: "French",
  gaa: "Ga",
  gjn: "Gonja",
  gur: "Gurene",
  hau: "Hausa",
  ibo: "Igbo",
  xsm: "Kasem",
  kik: "Kikuyu",
  xon: "Konkomba (Likpakpaanl)",
  lxn: "Konkomba (Likoonli)",
  kri: "Krio",
  kus: "Kusaal",
  luo: "Luo",
  maw: "Mampruli",
  men: "Mende",
  mer: "Meru/Kimeru",
  nzi: "Nzema",
  pcm: "Pidgin",
  sna: "Shona",
  swa: "Swahili",
  tem: "Temne",
  wlx: "Wali",
  wol: "Wolof",
  yor: "Yoruba",
};

// ---------------------------------------------------------------------------
// Internal helper functions (plain async, not Convex functions)
// ---------------------------------------------------------------------------

/**
 * Splits text into chunks at sentence boundaries so each chunk stays
 * below the Khaya Translation API's 1000-character limit per request.
 */
function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLen) {
    const window = remaining.slice(0, maxLen);

    // Prefer splitting at the end of a sentence.
    let splitAt = window.lastIndexOf(". ");
    if (splitAt < maxLen / 2) {
      splitAt = window.lastIndexOf("\n");
    }
    if (splitAt < maxLen / 2) {
      // Fall back to last word boundary.
      splitAt = window.lastIndexOf(" ");
    }
    if (splitAt <= 0) {
      splitAt = maxLen;
    } else {
      // Advance past the separator character.
      splitAt += 1;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Translates a block of text from English to the given Khaya translation code,
 * chunking as needed to stay within the 1000-character API limit.
 */
async function translateText(
  text: string,
  translationCode: string,
  apiKey: string
): Promise<string> {
  const chunks = chunkText(text, 950);
  const translated: string[] = [];

  for (const chunk of chunks) {
    const response = await fetch(`${KHAYA_API_BASE}/v1/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      body: JSON.stringify({ in: chunk, lang: `en-${translationCode}` }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Translation failed (${response.status}): ${errorText}`);
    }

    // The API returns a plain JSON-encoded string (not an object).
    const result = await response.json() as string;
    translated.push(typeof result === "string" ? result : chunk);
  }

  return translated.join(" ");
}

/**
 * Calls the Khaya TTS synthesize endpoint for a single chunk (≤950 chars)
 * and returns raw MP3 bytes.
 */
async function synthesizeSpeechChunk(
  text: string,
  ttsLanguageCode: string,
  speakerId: string,
  apiKey: string
): Promise<ArrayBuffer> {
  const response = await fetch(`${KHAYA_API_BASE}/tts/v2/synthesize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": apiKey,
    },
    body: JSON.stringify({
      text,
      language: ttsLanguageCode,
      speaker_id: speakerId,
      stream: false,
      format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`TTS synthesis failed (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}

/**
 * Synthesizes arbitrarily long text by splitting it into small chunks,
 * synthesizing each chunk, and concatenating the resulting MP3 byte streams.
 * MP3 frames are self-contained, so simple byte concatenation produces a
 * valid, playable file in all modern browsers.
 *
 * The chunk limit is set well below the API's 1000-char cap because
 * non-Latin scripts can tokenize into 2-3x more tokens per character,
 * and the underlying model enforces a ~600-token sequence limit.
 */
async function synthesizeSpeech(
  text: string,
  ttsLanguageCode: string,
  speakerId: string,
  apiKey: string
): Promise<ArrayBuffer> {
  const chunks = chunkText(text, 300);

  const audioChunks: ArrayBuffer[] = [];
  for (const chunk of chunks) {
    const buf = await synthesizeSpeechChunk(
      chunk,
      ttsLanguageCode,
      speakerId,
      apiKey
    );
    audioChunks.push(buf);
  }

  if (audioChunks.length === 1) return audioChunks[0];

  // Concatenate all MP3 buffers into one contiguous ArrayBuffer.
  const totalBytes = audioChunks.reduce((sum, b) => sum + b.byteLength, 0);
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buf of audioChunks) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return combined.buffer;
}

// ---------------------------------------------------------------------------
// Public Convex action
// ---------------------------------------------------------------------------

/**
 * Generates a translated lesson on a revision topic and synthesizes it as
 * audio using the Khaya AI translation + TTS APIs.
 *
 * Flow:
 *  1. Generate English lesson via OpenAI (calls api.ai.quickLearnTopic, Node runtime)
 *  2. Translate title, key points, and explanation to the target language (if supported)
 *  3. Synthesize the translated (or English) lesson as MP3 audio
 *  4. Store the audio in Convex file storage and return a signed URL
 */
export const teachMe = action({
  args: {
    topic: v.string(),
    sourceSessionId: v.id("studySessions"),
    targetLanguage: v.string(), // Khaya TTS language code, e.g. "twi"
    speakerId: v.optional(v.string()), // "female" | "male_low" | "male_high"
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const apiKey = process.env.KHAYA_KEY;
    if (!apiKey) throw new Error("KHAYA_KEY environment variable is not set");

    const speaker = args.speakerId ?? "female";
    const languageName = TTS_CODE_TO_NAME[args.targetLanguage] ?? args.targetLanguage;

    // Step 1: Generate English lesson (cross-runtime call: V8 -> Node).
    // Explicit type annotation required to avoid TypeScript circularity error.
    const lesson: QuickLearnResult = await ctx.runAction(
      api.ai.quickLearnTopic,
      { topic: args.topic, sourceSessionId: args.sourceSessionId }
    );

    // Step 2: Translate content if the target language supports it
    const translationCode = TRANSLATION_SUPPORT[args.targetLanguage];
    let translatedTitle = lesson.lesson.title;
    let translatedKeyPoints = [...lesson.lesson.keyPoints];
    let translatedExplanation = lesson.lesson.explanation;
    let isTranslated = false;

    if (translationCode) {
      try {
        translatedTitle = await translateText(
          lesson.lesson.title,
          translationCode,
          apiKey
        );

        const translatedPoints: string[] = [];
        for (const point of lesson.lesson.keyPoints) {
          const tp = await translateText(point, translationCode, apiKey);
          translatedPoints.push(tp);
        }
        translatedKeyPoints = translatedPoints;

        translatedExplanation = await translateText(
          lesson.lesson.explanation,
          translationCode,
          apiKey
        );

        isTranslated = true;
      } catch (err) {
        // Gracefully fall back to English content on translation failure.
        console.error("Khaya translation failed, falling back to English:", err);
      }
    }

    // Step 3: Build narration text from translated (or English) content
    const narrateText = [
      translatedTitle,
      translatedKeyPoints.join(". "),
      translatedExplanation,
    ]
      .filter(Boolean)
      .join(". ");

    // Step 4: Synthesize speech
    const audioBuffer = await synthesizeSpeech(
      narrateText,
      args.targetLanguage,
      speaker,
      apiKey
    );

    // Step 5: Store audio in Convex file storage
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    const storageId = await ctx.storage.store(audioBlob);
    const audioUrl = await ctx.storage.getUrl(storageId);

    return {
      originalLesson: lesson.lesson,
      translatedLesson: {
        title: translatedTitle,
        keyPoints: translatedKeyPoints,
        explanation: translatedExplanation,
      },
      audioUrl,
      languageName,
      isTranslated,
    };
  },
});
