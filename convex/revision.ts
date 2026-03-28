import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";

// SM-2 algorithm for spaced repetition
function sm2(
  quality: number, // 0-5: 0-1=fail, 2=barely, 3=correct, 4=easy, 5=perfect
  repetitions: number,
  interval: number,
  easeFactor: number
): { interval: number; repetitions: number; easeFactor: number } {
  if (quality < 3) {
    return {
      interval: 1,
      repetitions: 0,
      easeFactor: Math.max(1.3, easeFactor - 0.2),
    };
  }

  const newEF = easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  const newInterval =
    repetitions === 0 ? 1 : repetitions === 1 ? 6 : Math.round(interval * easeFactor);

  return {
    interval: newInterval,
    repetitions: repetitions + 1,
    easeFactor: Math.max(1.3, newEF),
  };
}

export const getRevisionQueue = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const now = Date.now();
    const items = await ctx.db
      .query("revisionItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return items
      .filter((item) => item.nextReviewAt <= now + 24 * 60 * 60 * 1000)
      .sort((a, b) => {
        if (a.isCritical && !b.isCritical) return -1;
        if (!a.isCritical && b.isCritical) return 1;
        return a.nextReviewAt - b.nextReviewAt;
      });
  },
});

export const getAllRevisionItems = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("revisionItems")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const reviewItem = mutation({
  args: {
    itemId: v.id("revisionItems"),
    quality: v.number(), // 0-5
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== user._id) throw new Error("Not found");

    const { interval, repetitions, easeFactor } = sm2(
      args.quality,
      item.repetitions,
      item.interval,
      item.easeFactor
    );

    const nextReviewAt =
      Date.now() + interval * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.itemId, {
      interval,
      repetitions,
      easeFactor,
      nextReviewAt,
      lastReviewedAt: Date.now(),
      isCritical: repetitions < 2 && args.quality < 3,
    });
  },
});

export const addRevisionItem = mutation({
  args: {
    topic: v.string(),
    sourceSessionId: v.id("studySessions"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("revisionItems")
      .withIndex("by_user_topic", (q) =>
        q.eq("userId", user._id).eq("topic", args.topic)
      )
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("revisionItems", {
      userId: user._id,
      topic: args.topic,
      sourceSessionId: args.sourceSessionId,
      difficulty: 0,
      interval: 1,
      repetitions: 0,
      easeFactor: 2.5,
      nextReviewAt: Date.now() + 24 * 60 * 60 * 1000,
      isCritical: false,
      notes: args.notes,
    });
  },
});

export const deleteRevisionItem = mutation({
  args: { itemId: v.id("revisionItems") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== user._id) throw new Error("Not found");

    await ctx.db.delete(args.itemId);
  },
});
