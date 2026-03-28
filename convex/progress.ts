import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";
import { syncProgressStats } from "./stats";

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

export const updateProgress = mutation({
  args: {
    sessionId: v.id("studySessions"),
    materialId: v.id("materials"),
    currentPage: v.number(),
    totalPages: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const now = Date.now();

    const existing = await ctx.db
      .query("progress")
      .withIndex("by_material_user", (q) =>
        q.eq("materialId", args.materialId).eq("userId", user._id)
      )
      .first();

    let pagesDelta = 0;
    let timeDeltaMinutes = 0;

    if (existing) {
      const pagesVisited = Array.from(
        new Set([...existing.pagesVisited, args.currentPage])
      );
      const timeDeltaSeconds = Math.round(
        (now - existing.lastUpdatedAt) / 1000
      );
      const timeSpent = existing.timeSpentSeconds + timeDeltaSeconds;

      pagesDelta = pagesVisited.length - existing.pagesVisited.length;
      timeDeltaMinutes = timeDeltaSeconds / 60;

      await ctx.db.patch(existing._id, {
        currentPage: args.currentPage,
        pagesVisited,
        lastUpdatedAt: now,
        timeSpentSeconds: timeSpent,
        completedAt:
          pagesVisited.length >= args.totalPages ? now : existing.completedAt,
      });
    } else {
      pagesDelta = 1;

      await ctx.db.insert("progress", {
        sessionId: args.sessionId,
        materialId: args.materialId,
        userId: user._id,
        currentPage: args.currentPage,
        totalPages: args.totalPages,
        pagesVisited: [args.currentPage],
        startedAt: now,
        lastUpdatedAt: now,
        timeSpentSeconds: 0,
      });
    }

    const member = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .first();

    if (member) {
      await ctx.db.patch(member._id, {
        currentMaterialId: args.materialId,
        currentPage: args.currentPage,
        lastHeartbeat: now,
      });
    }

    if (pagesDelta > 0 || timeDeltaMinutes > 0) {
      await syncProgressStats(
        ctx,
        user._id,
        timeDeltaMinutes,
        pagesDelta,
        false
      );
    }
  },
});

export const getMyProgress = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("progress")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .collect();
  },
});

export const getAllProgress = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const members = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const progressByUser = await Promise.all(
      members.map(async (m) => {
        const progressRecords = await ctx.db
          .query("progress")
          .withIndex("by_session_user", (q) =>
            q.eq("sessionId", args.sessionId).eq("userId", m.userId)
          )
          .collect();

        const totalPagesRead = progressRecords.reduce(
          (sum, p) => sum + p.pagesVisited.length,
          0
        );

        return {
          userId: m.userId,
          userName: m.userName,
          status: m.status,
          currentPage: m.currentPage,
          currentMaterialId: m.currentMaterialId,
          speedMinPerPage: m.speedMinPerPage,
          totalPagesRead,
          progress: progressRecords,
        };
      })
    );

    return progressByUser;
  },
});

export const getSessionProgress = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const myProgress = await ctx.db
      .query("progress")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .collect();

    const totalPages = session.totalPages ?? 0;
    const pagesRead = myProgress.reduce(
      (sum, p) => sum + p.pagesVisited.length,
      0
    );
    const percentage = totalPages > 0 ? (pagesRead / totalPages) * 100 : 0;

    const member = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .first();

    const remainingPages = totalPages - pagesRead;
    const estimatedMinRemaining = member
      ? remainingPages * member.speedMinPerPage
      : 0;

    return {
      pagesRead,
      totalPages,
      percentage,
      estimatedMinRemaining,
      progress: myProgress,
    };
  },
});

export const getTimelineData = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

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

    const now = Date.now();
    const sessionTotalPages = session.totalPages ?? 0;
    const elapsedMinutes = session.actualStart
      ? (now - session.actualStart) / 60000
      : 0;
    const sessionDurationMinutes =
      (session.scheduledEnd - session.scheduledStart) / 60000;

    const materialSegments = materials
      .sort((a, b) => a.order - b.order)
      .map((m) => ({
        _id: m._id,
        title: m.title,
        type: m.type,
        totalPages: effectivePageCount(m.totalPages, m.startPage, m.endPage),
      }));

    let cumulativePagesBefore = 0;
    const materialOffsets: Record<string, number> = {};
    for (const seg of materialSegments) {
      materialOffsets[seg._id] = cumulativePagesBefore;
      cumulativePagesBefore += seg.totalPages;
    }

    const checkIns = await ctx.db
      .query("checkIns")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const memberTimelines = await Promise.all(
      members.map(async (m) => {
        const progressRecords = await ctx.db
          .query("progress")
          .withIndex("by_session_user", (q) =>
            q.eq("sessionId", args.sessionId).eq("userId", m.userId)
          )
          .collect();

        const totalPagesRead = progressRecords.reduce(
          (sum, p) => sum + p.pagesVisited.length,
          0
        );
        const totalTimeSpent = progressRecords.reduce(
          (sum, p) => sum + p.timeSpentSeconds,
          0
        );

        const globalPosition = m.currentMaterialId
          ? (materialOffsets[m.currentMaterialId] ?? 0) + m.currentPage
          : totalPagesRead;

        const remainingPages = sessionTotalPages - totalPagesRead;
        const estimatedMinRemaining = remainingPages * m.speedMinPerPage;

        const expectedPosition =
          sessionTotalPages > 0
            ? Math.min(
                sessionTotalPages,
                Math.floor(elapsedMinutes / m.speedMinPerPage)
              )
            : 0;

        const percentComplete =
          sessionTotalPages > 0
            ? (totalPagesRead / sessionTotalPages) * 100
            : 0;

        const memberCheckIns = checkIns
          .filter((c) => c.userId === m.userId && c.status !== "pending")
          .sort((a, b) => b.promptedAt - a.promptedAt);

        const latestCheckIn = memberCheckIns[0] ?? null;

        return {
          userId: m.userId,
          userName: m.userName,
          userImage: m.userImage,
          avatarColor: m.avatarColor ?? "#6366F1",
          role: m.role,
          status: m.status,
          speedMinPerPage: m.speedMinPerPage,
          currentMaterialId: m.currentMaterialId,
          currentPage: m.currentPage,
          globalPosition,
          expectedPosition,
          totalPagesRead,
          percentComplete,
          estimatedMinRemaining,
          totalTimeSpentSeconds: totalTimeSpent,
          isMe: m.userId === user._id,
          latestCheckInStatus: latestCheckIn?.status ?? null,
          progressPerMaterial: progressRecords.map((p) => ({
            materialId: p.materialId,
            currentPage: p.currentPage,
            totalPages: p.totalPages,
            pagesVisited: p.pagesVisited.length,
            completedAt: p.completedAt,
          })),
        };
      })
    );

    return {
      sessionTitle: session.title,
      sessionStatus: session.status,
      sessionTotalPages,
      sessionDurationMinutes,
      elapsedMinutes,
      actualStart: session.actualStart,
      scheduledEnd: session.scheduledEnd,
      materialSegments,
      materialOffsets,
      members: memberTimelines,
      isSolo: members.length === 1,
    };
  },
});
