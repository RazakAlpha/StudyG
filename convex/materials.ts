import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";

function effectivePageCount(
  totalPages: number | undefined,
  startPage: number | undefined,
  endPage: number | undefined
): number {
  const total = totalPages ?? 1;
  if (startPage != null && endPage != null) {
    return Math.max(1, Math.min(endPage, total) - Math.max(1, startPage) + 1);
  }
  return total;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveMaterial = mutation({
  args: {
    sessionId: v.id("studySessions"),
    title: v.string(),
    type: v.union(v.literal("document"), v.literal("image"), v.literal("pdf")),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    totalPages: v.optional(v.number()),
    startPage: v.optional(v.number()),
    endPage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const member = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .first();
    if (!member) throw new Error("Not a member of this session");

    const existing = await ctx.db
      .query("materials")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const total = args.totalPages ?? 1;
    const pages = effectivePageCount(total, args.startPage, args.endPage);

    const materialId = await ctx.db.insert("materials", {
      sessionId: args.sessionId,
      uploadedBy: user._id,
      title: args.title,
      type: args.type,
      storageId: args.storageId,
      mimeType: args.mimeType,
      totalPages: total,
      startPage: args.startPage,
      endPage: args.endPage,
      order: existing.length,
      uploadedAt: Date.now(),
    });

    const session = await ctx.db.get(args.sessionId);
    if (session) {
      const currentTotal = session.totalPages ?? 0;
      await ctx.db.patch(args.sessionId, {
        totalPages: currentTotal + pages,
      });
    }

    return materialId;
  },
});

export const getMyUploadedFiles = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const allMaterials = await ctx.db
      .query("materials")
      .withIndex("by_uploader", (q) => q.eq("uploadedBy", user._id))
      .collect();

    const seen = new Set<string>();
    const uniqueFiles: Array<{
      storageId: string;
      title: string;
      type: "document" | "image" | "pdf";
      mimeType: string;
      totalPages: number;
    }> = [];

    for (const m of allMaterials) {
      if (!seen.has(m.storageId)) {
        seen.add(m.storageId);
        uniqueFiles.push({
          storageId: m.storageId,
          title: m.title,
          type: m.type,
          mimeType: m.mimeType,
          totalPages: m.totalPages ?? 1,
        });
      }
    }

    return uniqueFiles;
  },
});

export const addExistingMaterial = mutation({
  args: {
    sessionId: v.id("studySessions"),
    storageId: v.id("_storage"),
    title: v.string(),
    type: v.union(v.literal("document"), v.literal("image"), v.literal("pdf")),
    mimeType: v.string(),
    totalPages: v.number(),
    startPage: v.optional(v.number()),
    endPage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const member = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .first();
    if (!member) throw new Error("Not a member of this session");

    const existing = await ctx.db
      .query("materials")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const pages = effectivePageCount(args.totalPages, args.startPage, args.endPage);

    const materialId = await ctx.db.insert("materials", {
      sessionId: args.sessionId,
      uploadedBy: user._id,
      title: args.title,
      type: args.type,
      storageId: args.storageId,
      mimeType: args.mimeType,
      totalPages: args.totalPages,
      startPage: args.startPage,
      endPage: args.endPage,
      order: existing.length,
      uploadedAt: Date.now(),
    });

    const session = await ctx.db.get(args.sessionId);
    if (session) {
      const currentTotal = session.totalPages ?? 0;
      await ctx.db.patch(args.sessionId, {
        totalPages: currentTotal + pages,
      });
    }

    return materialId;
  },
});

export const getMaterials = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const materials = await ctx.db
      .query("materials")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return materials.sort((a, b) => a.order - b.order);
  },
});

export const getMaterialUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const deleteMaterial = mutation({
  args: { materialId: v.id("materials") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const material = await ctx.db.get(args.materialId);
    if (!material) throw new Error("Material not found");
    if (material.uploadedBy !== user._id) throw new Error("Not authorized");

    await ctx.storage.delete(material.storageId);
    await ctx.db.delete(args.materialId);
  },
});

export const updateMaterialText = mutation({
  args: {
    materialId: v.id("materials"),
    extractedText: v.string(),
    totalPages: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.materialId, {
      extractedText: args.extractedText,
      ...(args.totalPages ? { totalPages: args.totalPages } : {}),
    });
  },
});

/** Used by server-side extraction (e.g. quiz generation) — not callable from clients. */
export const setMaterialExtractedTextInternal = internalMutation({
  args: {
    materialId: v.id("materials"),
    extractedText: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.materialId, {
      extractedText: args.extractedText,
    });
  },
});

// ---------------------------------------------------------------------------
// Internal queries used by the AI module
// ---------------------------------------------------------------------------

export const getMaterialById = internalQuery({
  args: { materialId: v.id("materials") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.materialId);
  },
});

export const getSessionMaterialTexts = internalQuery({
  args: {
    sessionId: v.id("studySessions"),
    materialId: v.optional(v.id("materials")),
  },
  handler: async (ctx, args) => {
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

export const getSessionSummaryData = internalQuery({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const materials = await ctx.db
      .query("materials")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    return {
      session,
      materials,
      memberCount: members.length,
    };
  },
});
