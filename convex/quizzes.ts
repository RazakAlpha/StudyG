import { internalMutation, internalQuery, mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";
import { syncProgressStats } from "./stats";

export const generateQuiz = action({
  args: {
    sessionId: v.id("studySessions"),
    materialId: v.optional(v.id("materials")),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const quizId: any = await ctx.runMutation(
      internal.quizzes.createQuizPlaceholder,
      {
        sessionId: args.sessionId,
        materialId: args.materialId,
        topic: args.topic,
      }
    );

    const sessionMeta = await ctx.runQuery(internal.quizzes.getSessionMetaForQuiz, {
      sessionId: args.sessionId,
    });
    if (!sessionMeta) {
      await ctx.runMutation(internal.quizzes.updateQuizStatus, {
        quizId,
        status: "failed",
      });
      throw new Error("Study session not found.");
    }

    let materials: any[] = await ctx.runQuery(
      internal.quizzes.getMaterialsForQuiz,
      {
        sessionId: args.sessionId,
        materialId: args.materialId,
      }
    );

    let materialText = materials
      .map((m: any) => (m.extractedText ?? "").trim())
      .filter(Boolean)
      .join("\n\n");

    if (!materialText) {
      await ctx.runAction(internal.ai.ensureMaterialsExtractedText, {
        sessionId: args.sessionId,
        materialId: args.materialId,
      });
      materials = await ctx.runQuery(internal.quizzes.getMaterialsForQuiz, {
        sessionId: args.sessionId,
        materialId: args.materialId,
      });
      materialText = materials
        .map((m: any) => (m.extractedText ?? "").trim())
        .filter(Boolean)
        .join("\n\n");
    }

    if (!materialText) {
      await ctx.runMutation(internal.quizzes.updateQuizStatus, {
        quizId,
        status: "failed",
      });
      throw new Error(
        "No extractable text found in your materials. PDFs and text files are supported; image-only uploads cannot be used for quizzes yet."
      );
    }

    const sessionBlock = [
      `Session: ${sessionMeta.title}`,
      ...(sessionMeta.description?.trim()
        ? [`About this session: ${sessionMeta.description.trim()}`]
        : []),
      "",
      "Study material:",
      materialText,
    ].join("\n");

    const context = sessionBlock.substring(0, 8000);

    try {
      const questions = await ctx.runAction(internal.ai.generateQuizQuestions, {
        context,
        topic: args.topic,
        questionCount: 8,
      });

      await ctx.runMutation(internal.quizzes.saveQuizQuestions, {
        quizId,
        questions,
      });

      return quizId;
    } catch (error) {
      await ctx.runMutation(internal.quizzes.updateQuizStatus, {
        quizId,
        status: "failed",
      });
      throw error;
    }
  },
});

export const createQuizPlaceholder = internalMutation({
  args: {
    sessionId: v.id("studySessions"),
    materialId: v.optional(v.id("materials")),
    topic: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("quizzes", {
      sessionId: args.sessionId,
      materialId: args.materialId,
      topic: args.topic,
      generatedAt: Date.now(),
      questions: [],
      status: "generating",
    });
  },
});

export const getSessionMetaForQuiz = internalQuery({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    return {
      title: session.title,
      description: session.description,
    };
  },
});

export const getMaterialsForQuiz = internalQuery({
  args: {
    sessionId: v.id("studySessions"),
    materialId: v.optional(v.id("materials")),
  },
  handler: async (ctx, args): Promise<any[]> => {
    if (args.materialId) {
      const m = await ctx.db.get(args.materialId);
      return m ? [m] : [];
    }
    return await ctx.db
      .query("materials")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const saveQuizQuestions = internalMutation({
  args: {
    quizId: v.id("quizzes"),
    questions: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quizId, {
      questions: args.questions,
      status: "ready",
    });
  },
});

export const updateQuizStatus = internalMutation({
  args: {
    quizId: v.id("quizzes"),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.quizId, { status: args.status });
  },
});

export const getSessionQuizzes = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quizzes")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const getQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.quizId);
  },
});

export const submitQuizAttempt = mutation({
  args: {
    quizId: v.id("quizzes"),
    sessionId: v.id("studySessions"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        userAnswer: v.string(),
        isCorrect: v.boolean(),
        timeSpentSeconds: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) throw new Error("Quiz not found");

    const correctCount = args.answers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / args.answers.length) * 100);

    // Find weak topics (questions answered incorrectly)
    const weakTopics: string[] = [];
    for (const answer of args.answers) {
      if (!answer.isCorrect) {
        const question = quiz.questions.find(
          (q: any) => q.id === answer.questionId
        );
        if (question && !weakTopics.includes(question.topic)) {
          weakTopics.push(question.topic);
        }
      }
    }

    const attemptId = await ctx.db.insert("quizAttempts", {
      quizId: args.quizId,
      sessionId: args.sessionId,
      userId: user._id,
      startedAt: Date.now(),
      completedAt: Date.now(),
      answers: args.answers,
      score,
      totalQuestions: args.answers.length,
      correctAnswers: correctCount,
      weakTopics,
    });

    await syncProgressStats(ctx, user._id, 0, 0, false, score);

    // Create revision items for weak topics
    for (const topic of weakTopics) {
      const existing = await ctx.db
        .query("revisionItems")
        .withIndex("by_user_topic", (q) =>
          q.eq("userId", user._id).eq("topic", topic)
        )
        .first();

      if (existing) {
        // SM-2 update with failing grade (0)
        await ctx.db.patch(existing._id, {
          repetitions: 0,
          interval: 1,
          easeFactor: Math.max(1.3, existing.easeFactor - 0.2),
          nextReviewAt: Date.now() + 24 * 60 * 60 * 1000,
          lastReviewedAt: Date.now(),
          isCritical: existing.repetitions < 2,
        });
      } else {
        await ctx.db.insert("revisionItems", {
          userId: user._id,
          topic,
          sourceSessionId: args.sessionId,
          sourceQuizId: args.quizId,
          difficulty: 0,
          interval: 1,
          repetitions: 0,
          easeFactor: 2.5,
          nextReviewAt: Date.now() + 24 * 60 * 60 * 1000,
          isCritical: false,
        });
      }
    }

    return { attemptId, score, weakTopics };
  },
});

export const getMyQuizAttempts = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("quizAttempts")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .collect();
  },
});

export const getAllMyAttempts = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("quizAttempts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});
