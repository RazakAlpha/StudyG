import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}export const getMyStats = query({
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

    const today = getTodayString();

    const existingLog = await ctx.db
      .query("activityLogs")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", today)
      )
      .first();

    if (existingLog) {
      const newScore =
        args.quizScore !== undefined
          ? (existingLog.averageScore ?? 0 + args.quizScore) / 2
          : existingLog.averageScore;

      await ctx.db.patch(existingLog._id, {
        minutesStudied: existingLog.minutesStudied + args.minutesStudied,
        pagesRead: existingLog.pagesRead + args.pagesRead,
        sessionsCompleted:
          existingLog.sessionsCompleted + (args.sessionCompleted ? 1 : 0),
        quizzesTaken: existingLog.quizzesTaken + (args.quizScore !== undefined ? 1 : 0),
        averageScore: newScore,
      });
    } else {
      await ctx.db.insert("activityLogs", {
        userId: user._id,
        date: today,
        minutesStudied: args.minutesStudied,
        pagesRead: args.pagesRead,
        sessionsCompleted: args.sessionCompleted ? 1 : 0,
        quizzesTaken: args.quizScore !== undefined ? 1 : 0,
        averageScore: args.quizScore,
      });
    }

    // Update aggregate stats
    const existingStats = await ctx.db
      .query("learningStats")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingStats) {
      const newAvgScore =
        args.quizScore !== undefined
          ? (existingStats.averageQuizScore * existingStats.totalQuizzesAttempted +
              args.quizScore) /
            (existingStats.totalQuizzesAttempted + 1)
          : existingStats.averageQuizScore;

      await ctx.db.patch(existingStats._id, {
        totalPagesRead: existingStats.totalPagesRead + args.pagesRead,
        totalTimeMinutes: existingStats.totalTimeMinutes + args.minutesStudied,
        totalSessionsCompleted:
          existingStats.totalSessionsCompleted + (args.sessionCompleted ? 1 : 0),
        totalQuizzesAttempted:
          existingStats.totalQuizzesAttempted +
          (args.quizScore !== undefined ? 1 : 0),
        averageQuizScore: newAvgScore,
        weeklyMinutesThisWeek:
          existingStats.weeklyMinutesThisWeek + args.minutesStudied,
        lastStudyDate: Date.now(),
      });
    } else {
      await ctx.db.insert("learningStats", {
        userId: user._id,
        totalSessionsCompleted: args.sessionCompleted ? 1 : 0,
        totalPagesRead: args.pagesRead,
        totalTimeMinutes: args.minutesStudied,
        currentStreak: 1,
        longestStreak: 1,
        lastStudyDate: Date.now(),
        averageQuizScore: args.quizScore ?? 0,
        totalQuizzesAttempted: args.quizScore !== undefined ? 1 : 0,
        weeklyGoalMinutes: 300,
        weeklyMinutesThisWeek: args.minutesStudied,
      });
    }
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
      await ctx.db.patch(stats._id, { weeklyGoalMinutes: args.weeklyGoalMinutes });
    }
  },
});
