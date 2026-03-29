import { action, internalAction, internalQuery, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { authComponent } from "./betterAuth/auth";

type TeachMeResult = {
  originalLesson: {
    title: string;
    keyPoints: string[];
    explanation: string;
  };
  translatedLesson: {
    title: string;
    keyPoints: string[];
    explanation: string;
  };
  audioUrl: string | null;
  languageName: string;
  isTranslated: boolean;
  fromCache: boolean;
};

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

const KHAYA_API_BASE = "https://translation-api.ghananlp.org";

const TRANSLATION_SUPPORT: Record<string, string> = {
  twi: "tw",
  ewe: "ee",
  gaa: "gaa",
  fat: "fat",
  yor: "yo",
  dag: "dag",
  kik: "ki",
  gur: "gur",
  luo: "luo",
  mer: "mer",
  kus: "kus",
};

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(errorText: string, fallbackMs = 20_000): number {
  const match = errorText.match(/try again in (\d+) second/i);
  return match ? parseInt(match[1], 10) * 1000 : fallbackMs;
}

function chunkText(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLen) {
    const window = remaining.slice(0, maxLen);

    let splitAt = window.lastIndexOf(". ");
    if (splitAt < maxLen / 2) {
      splitAt = window.lastIndexOf("\n");
    }
    if (splitAt < maxLen / 2) {
      splitAt = window.lastIndexOf(" ");
    }
    if (splitAt <= 0) {
      splitAt = maxLen;
    } else {
      splitAt += 1;
    }

    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

async function translateChunk(
  chunk: string,
  translationCode: string,
  apiKey: string,
  retries = 3
): Promise<string> {
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
    if (response.status === 429 && retries > 0) {
      await sleep(parseRetryAfterMs(errorText));
      return translateChunk(chunk, translationCode, apiKey, retries - 1);
    }
    throw new Error(`Translation failed (${response.status}): ${errorText}`);
  }

  const result = await response.json() as string;
  return typeof result === "string" ? result : chunk;
}

async function translateText(
  text: string,
  translationCode: string,
  apiKey: string
): Promise<string> {
  const chunks = chunkText(text, 950);
  const translated: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(500);
    translated.push(await translateChunk(chunks[i], translationCode, apiKey));
  }

  return translated.join(" ");
}

async function synthesizeSpeechChunk(
  text: string,
  ttsLanguageCode: string,
  speakerId: string,
  apiKey: string,
  retries = 3
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
      stream: true,
      format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    if (response.status === 429 && retries > 0) {
      await sleep(parseRetryAfterMs(errorText));
      return synthesizeSpeechChunk(text, ttsLanguageCode, speakerId, apiKey, retries - 1);
    }
    throw new Error(`TTS synthesis failed (${response.status}): ${errorText}`);
  }

  return response.arrayBuffer();
}

function concatenateMp3(chunks: ArrayBuffer[]): ArrayBuffer {
  if (chunks.length === 1) return chunks[0];

  let totalBytes = 0;
  for (const chunk of chunks) totalBytes += chunk.byteLength;

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }

  return combined.buffer;
}

async function synthesizeSpeech(
  text: string,
  ttsLanguageCode: string,
  speakerId: string,
  apiKey: string
): Promise<ArrayBuffer> {
  const chunks = chunkText(text, 300);

  const audioChunks: ArrayBuffer[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(1000);
    const buf = await synthesizeSpeechChunk(
      chunks[i],
      ttsLanguageCode,
      speakerId,
      apiKey
    );
    audioChunks.push(buf);
  }

  return concatenateMp3(audioChunks);
}

export const findCachedLesson = internalQuery({
  args: {
    userId: v.string(),
    revisionItemId: v.id("revisionItems"),
    targetLanguage: v.string(),
    speakerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("teachMeLessons")
      .withIndex("by_user_item_lang_speaker", (q) =>
        q.eq("userId", args.userId)
          .eq("revisionItemId", args.revisionItemId)
          .eq("targetLanguage", args.targetLanguage)
          .eq("speakerId", args.speakerId)
      )
      .first();
  },
});

export const saveCachedLesson = internalMutation({
  args: {
    userId: v.string(),
    revisionItemId: v.id("revisionItems"),
    targetLanguage: v.string(),
    speakerId: v.string(),
    originalLesson: v.object({
      title: v.string(),
      keyPoints: v.array(v.string()),
      explanation: v.string(),
    }),
    translatedLesson: v.object({
      title: v.string(),
      keyPoints: v.array(v.string()),
      explanation: v.string(),
    }),
    isTranslated: v.boolean(),
    languageName: v.string(),
    audioStorageId: v.id("_storage"),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("teachMeLessons")
      .withIndex("by_user_item_lang_speaker", (q) =>
        q.eq("userId", args.userId)
          .eq("revisionItemId", args.revisionItemId)
          .eq("targetLanguage", args.targetLanguage)
          .eq("speakerId", args.speakerId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("teachMeLessons", {
      userId: args.userId,
      revisionItemId: args.revisionItemId,
      targetLanguage: args.targetLanguage,
      speakerId: args.speakerId,
      originalLesson: args.originalLesson,
      translatedLesson: args.translatedLesson,
      isTranslated: args.isTranslated,
      languageName: args.languageName,
      audioStorageId: args.audioStorageId,
      createdAt: args.createdAt,
    });
  },
});

export const teachMe = action({
  args: {
    revisionItemId: v.id("revisionItems"),
    topic: v.string(),
    sourceSessionId: v.id("studySessions"),
    targetLanguage: v.string(),
    speakerId: v.optional(v.string()),
    forceRegenerate: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<TeachMeResult> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const apiKey = process.env.KHAYA_KEY;
    if (!apiKey) throw new Error("KHAYA_KEY environment variable is not set");

    const speaker = args.speakerId ?? "female";
    const languageName = TTS_CODE_TO_NAME[args.targetLanguage] ?? args.targetLanguage;

    if (!args.forceRegenerate) {
      const cached = await ctx.runQuery(
        internal.khaya.findCachedLesson,
        {
          userId: user._id,
          revisionItemId: args.revisionItemId,
          targetLanguage: args.targetLanguage,
          speakerId: speaker,
        }
      );

      if (cached) {
        const audioUrl = await ctx.storage.getUrl(cached.audioStorageId);
        return {
          originalLesson: cached.originalLesson,
          translatedLesson: cached.translatedLesson,
          audioUrl,
          languageName: cached.languageName,
          isTranslated: cached.isTranslated,
          fromCache: true,
        };
      }
    }

    const lesson: QuickLearnResult = await ctx.runAction(
      api.ai.quickLearnTopic,
      {
        topic: args.topic,
        sourceSessionId: args.sourceSessionId,
        rebuild: args.forceRegenerate ?? false,
      }
    );

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
        console.error("Khaya translation failed, falling back to English:", err);
      }
    }

    const narrateText = [
      translatedTitle,
      translatedKeyPoints.join(". "),
      translatedExplanation,
    ]
      .filter(Boolean)
      .join(". ");

    const audioBuffer = await synthesizeSpeech(
      narrateText,
      args.targetLanguage,
      speaker,
      apiKey
    );

    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    const storageId = await ctx.storage.store(audioBlob);
    const audioUrl = await ctx.storage.getUrl(storageId);

    const originalLesson = lesson.lesson;
    const translatedLesson = {
      title: translatedTitle,
      keyPoints: translatedKeyPoints,
      explanation: translatedExplanation,
    };

    await ctx.runMutation(internal.khaya.saveCachedLesson, {
      userId: user._id,
      revisionItemId: args.revisionItemId,
      targetLanguage: args.targetLanguage,
      speakerId: speaker,
      originalLesson,
      translatedLesson,
      isTranslated,
      languageName,
      audioStorageId: storageId,
      createdAt: Date.now(),
    });

    return {
      originalLesson,
      translatedLesson,
      audioUrl,
      languageName,
      isTranslated,
      fromCache: false,
    };
  },
});

export const getCachedLesson = query({
  args: {
    revisionItemId: v.id("revisionItems"),
    targetLanguage: v.string(),
    speakerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return { exists: false };

    const cached = await ctx.db
      .query("teachMeLessons")
      .withIndex("by_user_item_lang_speaker", (q) =>
        q.eq("userId", user._id)
          .eq("revisionItemId", args.revisionItemId)
          .eq("targetLanguage", args.targetLanguage)
          .eq("speakerId", args.speakerId)
      )
      .first();

    return { exists: !!cached };
  },
});

/**
 * Returns the saved Teach Me lesson from the database (same shape as the teachMe action).
 * Use this for cache hits so the client reads from Convex without running the action.
 */
export const getTeachMeLesson = query({
  args: {
    revisionItemId: v.id("revisionItems"),
    targetLanguage: v.string(),
    speakerId: v.string(),
  },
  handler: async (ctx, args): Promise<TeachMeResult | null> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const cached = await ctx.db
      .query("teachMeLessons")
      .withIndex("by_user_item_lang_speaker", (q) =>
        q.eq("userId", user._id)
          .eq("revisionItemId", args.revisionItemId)
          .eq("targetLanguage", args.targetLanguage)
          .eq("speakerId", args.speakerId)
      )
      .first();

    if (!cached) return null;

    const audioUrl = await ctx.storage.getUrl(cached.audioStorageId);
    return {
      originalLesson: cached.originalLesson,
      translatedLesson: cached.translatedLesson,
      audioUrl,
      languageName: cached.languageName,
      isTranslated: cached.isTranslated,
      fromCache: true,
    };
  },
});