import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const lessonValidator = v.object({
  title: v.string(),
  keyPoints: v.array(v.string()),
  explanation: v.string(),
});

const questionsValidator = v.array(
  v.object({
    id: v.string(),
    question: v.string(),
    options: v.array(v.string()),
    correctAnswer: v.string(),
    explanation: v.string(),
  })
);

export const getQuickLearnCache = internalQuery({
  args: {
    sourceSessionId: v.id("studySessions"),
    topicKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quickLearnTopicCache")
      .withIndex("by_session_topic", (q) =>
        q.eq("sourceSessionId", args.sourceSessionId).eq("topicKey", args.topicKey)
      )
      .unique();
  },
});

export const upsertQuickLearnCache = internalMutation({
  args: {
    sourceSessionId: v.id("studySessions"),
    topicKey: v.string(),
    contextFingerprint: v.string(),
    lesson: lessonValidator,
    questions: questionsValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("quickLearnTopicCache")
      .withIndex("by_session_topic", (q) =>
        q.eq("sourceSessionId", args.sourceSessionId).eq("topicKey", args.topicKey)
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        contextFingerprint: args.contextFingerprint,
        lesson: args.lesson,
        questions: args.questions,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("quickLearnTopicCache", {
        sourceSessionId: args.sourceSessionId,
        topicKey: args.topicKey,
        contextFingerprint: args.contextFingerprint,
        lesson: args.lesson,
        questions: args.questions,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
