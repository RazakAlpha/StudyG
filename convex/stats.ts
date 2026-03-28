import { mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Shared helper called from progress.ts, sessions.ts, quizzes.ts
 * to keep learningStats + activityLogs in sync on every mutation
 * that affects study metrics.
 */
export async function syncProgressStats(
  ctx: MutationCtx,
  userId: string,
  minutesDelta: number,
  pagesDelta: number,
  sessionCompleted: boolean,
  quizScore?: number
) {
  const today = getTodayString();

  // --- daily activity log ---
  const existingLog = await ctx.db
    .query("activityLogs")
    .withIndex("by_user_date", (q) =>
      q.eq("userId", userId).eq("date", today)
    )
    .first();

  if (existingLog) {
    const newScore =
      quizScore !== undefined
        ? existingLog.quizzesTaken > 0
          ? (existingLog.averageScore ?? 0) * existingLog.quizzesTaken /
              (existingLog.quizzesTaken + 1) +
            quizScore / (existingLog.quizzesTaken + 1)
          : quizScore
        : existingLog.averageScore;

    await ctx.db.patch(existingLog._id, {
      minutesStudied: existingLog.minutesStudied + minutesDelta,
      pagesRead: existingLog.pagesRead + pagesDelta,
      sessionsCompleted:
        existingLog.sessionsCompleted + (sessionCompleted ? 1 : 0),
      quizzesTaken:
        existingLog.quizzesTaken + (quizScore !== undefined ? 1 : 0),
      averageScore: newScore,
    });
  } else {
    await ctx.db.insert("activityLogs", {
      userId,
      date: today,
      minutesStudied: minutesDelta,
      pagesRead: pagesDelta,
      sessionsCompleted: sessionCompleted ? 1 : 0,
      quizzesTaken: quizScore !== undefined ? 1 : 0,
      averageScore: quizScore,
    });
  }

  // --- aggregate learningStats ---
  const stats = await ctx.db
    .query("learningStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();

  if (stats) {
    const lastDateStr = stats.lastStudyDate
      ? new Date(stats.lastStudyDate).toISOString().slice(0, 10)
      : null;

    let newStreak = stats.currentStreak;
    if (lastDateStr === today) {
      // already studied today — no change
    } else if (lastDateStr === getYesterdayString()) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    const newAvgScore =
      quizScore !== undefined
        ? stats.totalQuizzesAttempted > 0
          ? (stats.averageQuizScore * stats.totalQuizzesAttempted + quizScore) /
            (stats.totalQuizzesAttempted + 1)
          : quizScore
        : stats.averageQuizScore;

    await ctx.db.patch(stats._id, {
      totalPagesRead: stats.totalPagesRead + pagesDelta,
      totalTimeMinutes: stats.totalTimeMinutes + minutesDelta,
      totalSessionsCompleted:
        stats.totalSessionsCompleted + (sessionCompleted ? 1 : 0),
      totalQuizzesAttempted:
        stats.totalQuizzesAttempted + (quizScore !== undefined ? 1 : 0),
      averageQuizScore: newAvgScore,
      weeklyMinutesThisWeek: stats.weeklyMinutesThisWeek + minutesDelta,
      lastStudyDate: Date.now(),
      currentStreak: newStreak,
      longestStreak: Math.max(stats.longestStreak, newStreak),
    });
  } else {
    await ctx.db.insert("learningStats", {
      userId,
      totalSessionsCompleted: sessionCompleted ? 1 : 0,
      totalPagesRead: pagesDelta,
      totalTimeMinutes: minutesDelta,
      currentStreak: 1,
      longestStreak: 1,
      lastStudyDate: Date.now(),
      averageQuizScore: quizScore ?? 0,
      totalQuizzesAttempted: quizScore !== undefined ? 1 : 0,
      weeklyGoalMinutes: 300,
      weeklyMinutesThisWeek: minutesDelta,
    });
  }
}

// ───────────────────────── public queries ─────────────────────────

export const getMyStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const stats = await ctx.db
      .query("learningStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return (
      stats ?? {
        userId: user._id,
        totalSessionsCompleted: 0,
        totalPagesRead: 0,
        totalTimeMinutes: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageQuizScore: 0,
        totalQuizzesAttempted: 0,
        weeklyGoalMinutes: 300,
        weeklyMinutesThisWeek: 0,
      }
    );
  },
});

export const getActivityLog = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.days ?? 30);

    return logs.reverse();
  },
});

export const getTodayStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const today = getTodayString();
    const log = await ctx.db
      .query("activityLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", today)
      )
      .first();

    return (
      log ?? {
        minutesStudied: 0,
        pagesRead: 0,
        sessionsCompleted: 0,
        quizzesTaken: 0,
        averageScore: undefined,
      }
    );
  },
});

export const getActiveStudyingSummary = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const memberships = await ctx.db
      .query("sessionMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const member of memberships) {
      const session = await ctx.db.get(member.sessionId);
      if (!session || session.status !== "active") continue;

      const progress = await ctx.db
        .query("progress")
        .withIndex("by_session_user", (q) =>
          q.eq("sessionId", session._id).eq("userId", user._id)
        )
        .collect();

      const totalPagesRead = progress.reduce(
        (sum, p) => sum + p.pagesVisited.length,
        0
      );
      const totalTimeSpent = progress.reduce(
        (sum, p) => sum + p.timeSpentSeconds,
        0
      );
      const sessionTotalPages = session.totalPages ?? 0;
      const percentage =
        sessionTotalPages > 0
          ? Math.min(100, (totalPagesRead / sessionTotalPages) * 100)
          : 0;

      let currentMaterialTitle: string | undefined;
      if (member.currentMaterialId) {
        const material = await ctx.db.get(member.currentMaterialId);
        currentMaterialTitle = material?.title;
      }

      const elapsed = session.actualStart
        ? (Date.now() - session.actualStart) / 60000
        : 0;

      return {
        sessionId: session._id,
        title: session.title,
        totalPagesRead,
        sessionTotalPages,
        percentage,
        totalTimeSpentMinutes: Math.round(totalTimeSpent / 60),
        currentPage: member.currentPage,
        currentMaterialTitle,
        elapsedMinutes: Math.round(elapsed),
        topics: session.topics,
      };
    }

    return null;
  },
});

// ───────────────────────── public mutations ─────────────────────────

export const recordActivity = mutation({
  args: {
    minutesStudied: v.number(),
    pagesRead: v.number(),
    sessionCompleted: v.boolean(),
    quizScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return;

    await syncProgressStats(
      ctx,
      user._id,
      args.minutesStudied,
      args.pagesRead,
      args.sessionCompleted,
      args.quizScore
    );
  },
});

export const updateWeeklyGoal = mutation({
  args: { weeklyGoalMinutes: v.number() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const stats = await ctx.db
      .query("learningStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (stats) {
      await ctx.db.patch(stats._id, {
        weeklyGoalMinutes: args.weeklyGoalMinutes,
      });
    }
  },
});
