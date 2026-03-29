"use node";

import { createHash } from "crypto";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import OpenAI from "openai";
import { authComponent } from "./betterAuth/auth";

type QuickLearnTopicResult = {
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
  fromCache: boolean;
};

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY environment variable is not set");
  return new OpenAI({ apiKey });
}

function normalizeQuickLearnTopicKey(topic: string): string {
  return topic.trim().replace(/\s+/g, " ");
}

/**
 * Fetches files from storage and fills `extractedText` when missing (PDF and plain text).
 * The app does not always call `updateMaterialText` from the client; quiz generation needs text server-side.
 */
export const ensureMaterialsExtractedText = internalAction({
  args: {
    sessionId: v.id("studySessions"),
    materialId: v.optional(v.id("materials")),
  },
  handler: async (ctx, args) => {
    const materials: Doc<"materials">[] = await ctx.runQuery(
      internal.materials.getSessionMaterialTexts,
      args
    );
    const { getDocumentProxy, extractText } = await import("unpdf");

    for (const m of materials) {
      if ((m.extractedText ?? "").trim()) continue;

      const url = await ctx.storage.getUrl(m.storageId);
      if (!url) continue;

      const res = await fetch(url);
      if (!res.ok) continue;
      const arrayBuffer = await res.arrayBuffer();
      const mime = m.mimeType ?? "";

      let extracted = "";

      if (m.type === "pdf" || mime === "application/pdf") {
        try {
          const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
          const { text } = await extractText(pdf, { mergePages: true });
          extracted = (text ?? "").trim();
        } catch {
          extracted = "";
        }
      } else if (mime.startsWith("text/") || mime === "application/json") {
        extracted = Buffer.from(arrayBuffer).toString("utf-8").trim();
      } else if (m.type === "document" && mime.includes("text")) {
        extracted = Buffer.from(arrayBuffer).toString("utf-8").trim();
      }

      if (extracted) {
        await ctx.runMutation(internal.materials.setMaterialExtractedTextInternal, {
          materialId: m._id,
          extractedText: extracted,
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------
// Internal primitives — called by other Convex functions, not exposed publicly
// ---------------------------------------------------------------------------

/**
 * Generate quiz questions from study material text.
 * Returns a structured array of MCQ and short-answer questions.
 */
export const generateQuizQuestions = internalAction({
  args: {
    context: v.string(),
    topic: v.optional(v.string()),
    questionCount: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const openai = createOpenAIClient();
    const count = args.questionCount ?? 8;
    const topicClause = args.topic ? ` about "${args.topic}"` : "";

    const prompt = `You are an expert educator. Based on the following context${topicClause}, generate ${count} quiz questions to test comprehension. Base questions on the extracted study text (not filenames). The context may begin with the study session name and description, then the material text.

Context:
${args.context}

Generate a JSON array of questions with this exact format (no markdown, just pure JSON).

MCQ example:
{
  "id": "q1",
  "type": "mcq",
  "question": "...",
  "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
  "correctAnswer": "A. ...",
  "explanation": "...",
  "topic": "...",
  "difficulty": "easy"
}

Short-answer example:
{
  "id": "q2",
  "type": "short_answer",
  "question": "...",
  "correctAnswer": "A concise model answer for this question.",
  "explanation": "...",
  "topic": "...",
  "difficulty": "medium"
}

IMPORTANT RULES:
- Every question MUST include "correctAnswer" — for short_answer questions this is the model answer.
- Use "short_answer" (underscore), NOT "short-answer" (hyphen).
- difficulty must be exactly one of: "easy", "medium", "hard".

Include ${Math.ceil(count * 0.6)} MCQ questions and ${Math.floor(count * 0.4)} short-answer questions.
For short-answer questions, omit the options field.
Make questions genuinely test understanding, not just memorisation.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Invalid quiz response format from AI");

    const raw = JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>;

    const validDifficulties = new Set(["easy", "medium", "hard"]);

    const questions = raw.map((q, i) => {
      const type = String(q.type ?? "mcq").replace("-", "_");
      return {
        id: String(q.id ?? `q${i + 1}`),
        type: type === "short_answer" ? ("short_answer" as const) : ("mcq" as const),
        question: String(q.question ?? ""),
        ...(Array.isArray(q.options) ? { options: q.options.map(String) } : {}),
        correctAnswer: String(q.correctAnswer ?? q.answer ?? "See explanation."),
        explanation: String(q.explanation ?? ""),
        topic: String(q.topic ?? "General"),
        difficulty: (validDifficulties.has(String(q.difficulty))
          ? String(q.difficulty)
          : "medium") as "easy" | "medium" | "hard",
      };
    });

    return questions;
  },
});

/**
 * Summarise a block of study material text.
 * Returns a concise plain-text summary.
 */
export const summarizeMaterial = internalAction({
  args: {
    text: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const openai = createOpenAIClient();
    const titleClause = args.title ? ` titled "${args.title}"` : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Summarise the following study material${titleClause} in 3-5 concise paragraphs. Focus on the key ideas, main arguments, and important concepts a student should retain.

Material:
${args.text.substring(0, 12000)}

Return plain text only — no markdown, no bullet points.`,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content ?? "";
  },
});

/**
 * Extract the key topics and concepts from study material text.
 * Returns an array of topic strings.
 */
export const extractKeyTopics = internalAction({
  args: {
    text: v.string(),
  },
  handler: async (_ctx, args) => {
    const openai = createOpenAIClient();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Extract the key topics and concepts from the following study material.

Material:
${args.text.substring(0, 10000)}

Return a JSON array of short topic strings (max 5 words each), covering the most important concepts a student should review. Example format (pure JSON, no markdown):
["Photosynthesis process", "Light-dependent reactions", "Calvin cycle", "Chloroplast structure"]`,
        },
      ],
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [] as string[];
    return JSON.parse(jsonMatch[0]) as string[];
  },
});

// ---------------------------------------------------------------------------
// Public actions — called directly from the frontend
// ---------------------------------------------------------------------------

/**
 * Generate flashcards from a specific material.
 * Returns an array of { front, back } flashcard objects.
 */
export const generateFlashcards = action({
  args: {
    materialId: v.id("materials"),
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const material: any = await ctx.runQuery(
      internal.materials.getMaterialById,
      { materialId: args.materialId }
    );
    if (!material) throw new Error("Material not found");
    if (!material.extractedText?.trim()) {
      throw new Error("Material has no extractable text content");
    }

    const openai = createOpenAIClient();
    const count = args.count ?? 15;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Create ${count} flashcards from the following study material titled "${material.title}".

Material:
${material.extractedText.substring(0, 10000)}

Return a JSON array with this exact format (pure JSON, no markdown):
[
  {
    "front": "Question or term",
    "back": "Answer or definition",
    "topic": "Relevant topic name"
  }
]

Make flashcards test key concepts, definitions, relationships, and important facts.`,
        },
      ],
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Invalid flashcard response from AI");

    return JSON.parse(jsonMatch[0]) as Array<{
      front: string;
      back: string;
      topic: string;
    }>;
  },
});

/**
 * Explain a concept using the session's materials as context.
 * Returns a plain-text explanation tailored to the study material.
 */
export const explainConcept = action({
  args: {
    concept: v.string(),
    sessionId: v.id("studySessions"),
    materialId: v.optional(v.id("materials")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const materials: any[] = await ctx.runQuery(
      internal.materials.getSessionMaterialTexts,
      { sessionId: args.sessionId, materialId: args.materialId }
    );

    const context = materials
      .map((m: any) => `[${m.title}]\n${m.extractedText ?? ""}`)
      .join("\n\n")
      .substring(0, 10000);

    const openai = createOpenAIClient();

    const systemPrompt = context.trim()
      ? `You are a knowledgeable study tutor. Use the following study materials as primary context when explaining concepts. Always relate explanations back to the material when relevant.\n\nStudy Materials:\n${context}`
      : "You are a knowledgeable study tutor. Provide clear, accurate, and educational explanations.";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Please explain the following concept clearly and concisely:\n\n${args.concept}`,
        },
      ],
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content ?? "";
  },
});

/**
 * AI study tutor — answers questions about the session's study material.
 * Maintains conversation history for multi-turn dialogue.
 */
export const askAITutor = action({
  args: {
    question: v.string(),
    sessionId: v.id("studySessions"),
    materialId: v.optional(v.id("materials")),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const materials: any[] = await ctx.runQuery(
      internal.materials.getSessionMaterialTexts,
      { sessionId: args.sessionId, materialId: args.materialId }
    );

    const context = materials
      .map((m: any) => `[${m.title}]\n${m.extractedText ?? ""}`)
      .join("\n\n")
      .substring(0, 10000);

    const openai = createOpenAIClient();

    const systemContent = context.trim()
      ? `You are an expert study tutor helping a student understand their study materials. Answer questions based on the following materials. Be concise, accurate, and encouraging.\n\nStudy Materials:\n${context}`
      : "You are an expert study tutor. Help the student understand concepts clearly and accurately. Be concise and encouraging.";

    const history = (args.conversationHistory ?? []).slice(-10);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemContent },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: args.question },
      ],
      temperature: 0.6,
      max_tokens: 600,
    });

    return response.choices[0]?.message?.content ?? "";
  },
});

/**
 * Quick Learn & Revise — generates a concise lesson and mini-quiz
 * for a single revision topic so the user can refresh their memory
 * before rating their recall.
 */
export const quickLearnTopic = action({
  args: {
    topic: v.string(),
    sourceSessionId: v.id("studySessions"),
    rebuild: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<QuickLearnTopicResult> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const materials: any[] = await ctx.runQuery(
      internal.materials.getSessionMaterialTexts,
      { sessionId: args.sourceSessionId }
    );

    const context = materials
      .map((m: any) => `[${m.title}]\n${m.extractedText ?? ""}`)
      .join("\n\n")
      .substring(0, 8000);

    const topicKey = normalizeQuickLearnTopicKey(args.topic);
    const contextFingerprint = createHash("sha256").update(context).digest("hex");

    if (!args.rebuild) {
      const cached: Doc<"quickLearnTopicCache"> | null = await ctx.runQuery(
        internal.quickLearnCache.getQuickLearnCache,
        {
          sourceSessionId: args.sourceSessionId,
          topicKey,
        }
      );
      if (cached && cached.contextFingerprint === contextFingerprint) {
        return {
          lesson: cached.lesson,
          questions: cached.questions,
          fromCache: true,
        };
      }
    }

    const openai = createOpenAIClient();

    const hasContext = context.trim().length > 0;

    const prompt = `You are an expert study tutor. A student is revising the topic "${args.topic}".${hasContext ? `\n\nHere is their study material for context:\n${context}` : ""}

Generate a response in this EXACT JSON format (pure JSON, no markdown):
{
  "lesson": {
    "title": "A short title for the lesson",
    "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
    "explanation": "A clear, concise 2-3 paragraph explanation of the topic. Focus on the most important concepts the student needs to remember."
  },
  "questions": [
    {
      "id": "q1",
      "question": "A question testing understanding of this topic",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "A. ...",
      "explanation": "Brief explanation of why this is correct"
    },
    {
      "id": "q2",
      "question": "Another question on this topic",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "B. ...",
      "explanation": "Brief explanation"
    },
    {
      "id": "q3",
      "question": "A third question on this topic",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctAnswer": "C. ...",
      "explanation": "Brief explanation"
    }
  ]
}

IMPORTANT: Generate exactly 3 MCQ questions. Make the lesson educational and the questions genuinely test understanding.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid response format from AI");

    const parsed = JSON.parse(jsonMatch[0]) as {
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

    await ctx.runMutation(internal.quickLearnCache.upsertQuickLearnCache, {
      sourceSessionId: args.sourceSessionId,
      topicKey,
      contextFingerprint,
      lesson: parsed.lesson,
      questions: parsed.questions,
    });

    return {
      ...parsed,
      fromCache: false,
    };
  },
});

/**
 * Generate an end-of-session study summary including key takeaways,
 * topics covered, and personalised study recommendations.
 */
export const generateSessionSummary = action({
  args: {
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const sessionData: any = await ctx.runQuery(
      internal.materials.getSessionSummaryData,
      { sessionId: args.sessionId }
    );

    if (!sessionData) throw new Error("Session not found");

    const materialSummaries = sessionData.materials
      .map((m: any) => `• ${m.title} (${m.totalPages ?? 1} pages)`)
      .join("\n");

    const topicsText =
      sessionData.session.topics?.join(", ") || "General study topics";

    const openai = createOpenAIClient();

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Generate a concise study session summary for a student.

Session: "${sessionData.session.title}"
Topics studied: ${topicsText}
Materials covered:
${materialSummaries || "No materials uploaded"}
Members in session: ${sessionData.memberCount}

Write a brief summary (3-4 short paragraphs) that includes:
1. What was covered in this session
2. Key topics and concepts the student should remember
3. Suggested next steps or areas to review

Keep the tone encouraging and actionable. Return plain text only.`,
        },
      ],
      temperature: 0.6,
    });

    return {
      summary: response.choices[0]?.message?.content ?? "",
      topics: sessionData.session.topics ?? [],
      materialCount: sessionData.materials.length,
    };
  },
});
