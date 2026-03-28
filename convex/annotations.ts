import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";

const ANNOTATION_COLORS = [
  "#FBBF24",
  "#34D399",
  "#60A5FA",
  "#F87171",
  "#A78BFA",
];

export const addAnnotation = mutation({
  args: {
    materialId: v.id("materials"),
    sessionId: v.id("studySessions"),
    page: v.number(),
    content: v.string(),
    highlightText: v.optional(v.string()),
    isShared: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Assign a consistent color per user
    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const memberIndex = members.findIndex((m) => m.userId === user._id);
    const color = ANNOTATION_COLORS[memberIndex % ANNOTATION_COLORS.length];

    const now = Date.now();
    return await ctx.db.insert("annotations", {
      materialId: args.materialId,
      sessionId: args.sessionId,
      userId: user._id,
      userName: user.name ?? user.email,
      page: args.page,
      content: args.content,
      highlightText: args.highlightText,
      color,
      isShared: args.isShared,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateAnnotation = mutation({
  args: {
    annotationId: v.id("annotations"),
    content: v.string(),
    isShared: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("Not found");
    if (annotation.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.annotationId, {
      content: args.content,
      ...(args.isShared !== undefined ? { isShared: args.isShared } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const deleteAnnotation = mutation({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation) throw new Error("Not found");
    if (annotation.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.annotationId);
  },
});

export const getPageAnnotations = query({
  args: {
    materialId: v.id("materials"),
    page: v.number(),
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const all = await ctx.db
      .query("annotations")
      .withIndex("by_material_page", (q) =>
        q.eq("materialId", args.materialId).eq("page", args.page)
      )
      .collect();

    return all.filter((a) => a.isShared || a.userId === user._id);
  },
});

export const getMaterialAnnotations = query({
  args: {
    materialId: v.id("materials"),
    sessionId: v.id("studySessions"),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const all = await ctx.db
      .query("annotations")
      .withIndex("by_material", (q) => q.eq("materialId", args.materialId))
      .collect();

    return all.filter((a) => a.isShared || a.userId === user._id);
  },
});
