import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";

export const triggerCheckIn = internalMutation({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status !== "active") return;

    const now = Date.now();

    // Create check-in records for all active members
    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "active"),
          q.eq(q.field("status"), "idle")
        )
      )
      .collect();

    for (const member of members) {
      // Only create if no pending check-in for this member
      const pending = await ctx.db
        .query("checkIns")
        .withIndex("by_session_user", (q) =>
          q.eq("sessionId", args.sessionId).eq("userId", member.userId)
        )
        .filter((q) => q.eq(q.field("status"), "pending"))
        .first();

      if (!pending) {
        await ctx.db.insert("checkIns", {
          sessionId: args.sessionId,
          userId: member.userId,
          promptedAt: now,
          status: "pending",
        });
      }
    }

    // Schedule next check-in
    const nextCheckInAt = now + session.checkInIntervalMinutes * 60 * 1000;
    const scheduledId = await ctx.scheduler.runAt(
      nextCheckInAt,
      internal.checkIns.triggerCheckIn,
      { sessionId: args.sessionId }
    );

    await ctx.db.patch(args.sessionId, {
      nextCheckInAt,
      checkInScheduledId: scheduledId as any,
    });
  },
});

export const respondToCheckIn = mutation({
  args: {
    sessionId: v.id("studySessions"),
    status: v.union(
      v.literal("on_track"),
      v.literal("struggling"),
      v.literal("ahead")
    ),
    notes: v.optional(v.string()),
    currentPage: v.optional(v.number()),
    currentMaterialId: v.optional(v.id("materials")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const pending = await ctx.db
      .query("checkIns")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (!pending) throw new Error("No pending check-in");

    await ctx.db.patch(pending._id, {
      status: args.status,
      respondedAt: Date.now(),
      notes: args.notes,
      currentPage: args.currentPage,
    });

    if (args.currentPage !== undefined || args.currentMaterialId !== undefined) {
      const member = await ctx.db
        .query("sessionMembers")
        .withIndex("by_session_user", (q) =>
          q.eq("sessionId", args.sessionId).eq("userId", user._id)
        )
        .first();

      if (member) {
        const patch: Record<string, unknown> = {};
        if (args.currentPage !== undefined) patch.currentPage = args.currentPage;
        if (args.currentMaterialId !== undefined) patch.currentMaterialId = args.currentMaterialId;
        await ctx.db.patch(member._id, patch);
      }

      if (args.currentMaterialId && args.currentPage !== undefined) {
        const material = await ctx.db.get(args.currentMaterialId);
        if (material) {
          const existing = await ctx.db
            .query("progress")
            .withIndex("by_material_user", (q) =>
              q.eq("materialId", args.currentMaterialId!).eq("userId", user._id)
            )
            .first();

          if (existing) {
            const pagesVisited = Array.from(
              new Set([...existing.pagesVisited, args.currentPage])
            );
            await ctx.db.patch(existing._id, {
              currentPage: args.currentPage,
              pagesVisited,
              lastUpdatedAt: Date.now(),
            });
          } else {
            await ctx.db.insert("progress", {
              sessionId: args.sessionId,
              materialId: args.currentMaterialId,
              userId: user._id,
              currentPage: args.currentPage,
              totalPages: material.totalPages ?? 1,
              pagesVisited: [args.currentPage],
              startedAt: Date.now(),
              lastUpdatedAt: Date.now(),
              timeSpentSeconds: 0,
            });
          }
        }
      }
    }

    const statusLabel = {
      on_track: "on track",
      struggling: "struggling",
      ahead: "ahead of schedule",
    }[args.status];

    const pageInfo =
      args.currentPage !== undefined ? ` (page ${args.currentPage})` : "";

    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: user._id,
      userName: user.name ?? user.email,
      content: `${user.name ?? user.email} checked in: ${statusLabel}${pageInfo}${args.notes ? ` - "${args.notes}"` : ""}`,
      type: "progress_update",
      sentAt: Date.now(),
    });
  },
});

export const getPendingCheckIn = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("checkIns")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();
  },
});

export const getSessionCheckIns = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("checkIns")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});
