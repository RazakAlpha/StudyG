import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";

export const sendMessage = mutation({
  args: {
    sessionId: v.id("studySessions"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (!args.content.trim()) throw new Error("Message cannot be empty");

    return await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: user._id,
      userName: user.name ?? user.email,
      content: args.content.trim(),
      type: "text",
      sentAt: Date.now(),
    });
  },
});

export const getMessages = query({
  args: {
    sessionId: v.id("studySessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_session_time", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(args.limit ?? 100);

    return messages.reverse();
  },
});
