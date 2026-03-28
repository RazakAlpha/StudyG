import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { authComponent } from "./betterAuth/auth";

// Generate a random 6-char invite code
function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const AVATAR_COLORS = [
  "#6366F1", "#8B5CF6", "#A855F7", "#D946EF",
  "#EC4899", "#F43F5E", "#EF4444", "#F97316",
  "#F59E0B", "#EAB308", "#84CC16", "#22C55E",
  "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9",
  "#3B82F6", "#2563EB", "#7C3AED", "#9333EA",
];

function pickAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export const createSession = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    topics: v.array(v.string()),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    defaultSpeedMinPerPage: v.number(),
    isPublic: v.boolean(),
    checkInIntervalMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (args.checkInIntervalMinutes < args.defaultSpeedMinPerPage) {
      throw new Error(
        `Check-in interval (${args.checkInIntervalMinutes}m) cannot be less than reading speed (${args.defaultSpeedMinPerPage}m/page)`
      );
    }

    const inviteCode = generateInviteCode();

    const sessionId = await ctx.db.insert("studySessions", {
      creatorId: user._id,
      title: args.title,
      description: args.description,
      courseId: args.courseId,
      topics: args.topics,
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      defaultSpeedMinPerPage: args.defaultSpeedMinPerPage,
      status: "scheduled",
      isPublic: args.isPublic,
      inviteCode,
      checkInIntervalMinutes: args.checkInIntervalMinutes,
      totalPages: 0,
    });

    // Add creator as host member
    await ctx.db.insert("sessionMembers", {
      sessionId,
      userId: user._id,
      userName: user.name ?? user.email,
      userEmail: user.email,
      userImage: user.image ?? undefined,
      avatarColor: pickAvatarColor(),
      role: "host",
      status: "offline",
      speedMinPerPage: args.defaultSpeedMinPerPage,
      currentPage: 0,
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    return { sessionId, inviteCode };
  },
});

export const startSession = mutation({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.creatorId !== user._id) throw new Error("Not authorized");

    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      status: "active",
      actualStart: now,
    });

    // Schedule first check-in
    const firstCheckInAt = now + session.checkInIntervalMinutes * 60 * 1000;
    const scheduledId = await ctx.scheduler.runAt(
      firstCheckInAt,
      internal.checkIns.triggerCheckIn,
      { sessionId: args.sessionId }
    );

    await ctx.db.patch(args.sessionId, {
      nextCheckInAt: firstCheckInAt,
      checkInScheduledId: scheduledId as any,
    });

    // Update member status
    await updateMemberStatus(ctx, args.sessionId, user._id, "active");
  },
});

export const endSession = mutation({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.creatorId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.sessionId, {
      status: "completed",
      actualEnd: Date.now(),
    });

    // Cancel pending check-in if exists
    if (session.checkInScheduledId) {
      await ctx.scheduler.cancel(session.checkInScheduledId);
    }

    // Add system message
    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: "system",
      userName: "System",
      content: "Study session has ended. Great work everyone!",
      type: "system",
      sentAt: Date.now(),
    });
  },
});

export const pauseSession = mutation({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.creatorId !== user._id) throw new Error("Not authorized");
    if (session.status !== "active") throw new Error("Session is not active");

    await ctx.db.patch(args.sessionId, { status: "paused" });

    if (session.checkInScheduledId) {
      await ctx.scheduler.cancel(session.checkInScheduledId);
    }

    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: "system",
      userName: "System",
      content: "Study session has been paused by the host.",
      type: "system",
      sentAt: Date.now(),
    });
  },
});

export const resumeSession = mutation({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.creatorId !== user._id) throw new Error("Not authorized");
    if (session.status !== "paused") throw new Error("Session is not paused");

    const now = Date.now();
    await ctx.db.patch(args.sessionId, { status: "active" });

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

    await updateMemberStatus(ctx, args.sessionId, user._id, "active");

    await ctx.db.insert("chatMessages", {
      sessionId: args.sessionId,
      userId: "system",
      userName: "System",
      content: "Study session has been resumed!",
      type: "system",
      sentAt: Date.now(),
    });
  },
});

export const joinByInviteCode = mutation({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db
      .query("studySessions")
      .withIndex("by_invite_code", (q) => q.eq("inviteCode", args.inviteCode))
      .first();

    if (!session) throw new Error("Invalid invite code");
    if (session.status === "completed" || session.status === "cancelled") {
      throw new Error("Session is no longer active");
    }

    // Check if already a member
    const existing = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", session._id).eq("userId", user._id)
      )
      .first();

    if (existing) return { sessionId: session._id };

    await ctx.db.insert("sessionMembers", {
      sessionId: session._id,
      userId: user._id,
      userName: user.name ?? user.email,
      userEmail: user.email,
      userImage: user.image ?? undefined,
      avatarColor: pickAvatarColor(),
      role: "member",
      status: "active",
      speedMinPerPage: session.defaultSpeedMinPerPage,
      currentPage: 0,
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    // Add join notification
    await ctx.db.insert("chatMessages", {
      sessionId: session._id,
      userId: "system",
      userName: "System",
      content: `${user.name ?? user.email} joined the study session`,
      type: "system",
      sentAt: Date.now(),
    });

    return { sessionId: session._id };
  },
});

export const joinPublicSession = mutation({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (!session.isPublic) throw new Error("Session is not public");

    const existing = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .first();

    if (existing) return { sessionId: args.sessionId };

    await ctx.db.insert("sessionMembers", {
      sessionId: args.sessionId,
      userId: user._id,
      userName: user.name ?? user.email,
      userEmail: user.email,
      userImage: user.image ?? undefined,
      avatarColor: pickAvatarColor(),
      role: "member",
      status: "active",
      speedMinPerPage: session.defaultSpeedMinPerPage,
      currentPage: 0,
      lastHeartbeat: Date.now(),
      joinedAt: Date.now(),
    });

    return { sessionId: args.sessionId };
  },
});

export const updateMySpeed = mutation({
  args: {
    sessionId: v.id("studySessions"),
    speedMinPerPage: v.number(),
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
    await ctx.db.patch(member._id, { speedMinPerPage: args.speedMinPerPage });
  },
});

async function updateMemberStatus(
  ctx: any,
  sessionId: any,
  userId: string,
  status: "active" | "idle" | "away" | "offline"
) {
  const member = await ctx.db
    .query("sessionMembers")
    .withIndex("by_session_user", (q: any) =>
      q.eq("sessionId", sessionId).eq("userId", userId)
    )
    .first();
  if (member) {
    await ctx.db.patch(member._id, { status, lastHeartbeat: Date.now() });
  }
}

export const heartbeat = mutation({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return;
    await updateMemberStatus(ctx, args.sessionId, user._id, "active");
  },
});

export const getMySession = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const member = await ctx.db
      .query("sessionMembers")
      .withIndex("by_session_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", user._id)
      )
      .first();

    return { session, member };
  },
});

export const getMySessions = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];

    const memberships = await ctx.db
      .query("sessionMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const sessions = await Promise.all(
      memberships.map(async (m) => {
        const session = await ctx.db.get(m.sessionId);
        return session ? { session, membership: m } : null;
      })
    );

    return sessions.filter(Boolean).sort((a, b) =>
      b!.session.scheduledStart - a!.session.scheduledStart
    );
  },
});

export const getPublicSessions = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("studySessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .filter((q) => q.eq(q.field("isPublic"), true))
      .collect();

    return sessions;
  },
});

export const getSessionMembers = query({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessionMembers")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const deleteSession = mutation({
  args: { sessionId: v.id("studySessions") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");
    if (session.creatorId !== user._id) throw new Error("Not authorized");

    await ctx.db.patch(args.sessionId, { status: "cancelled" });
  },
});

export const getMyActiveCreatedSession = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return null;

    const activeSession = await ctx.db
      .query("studySessions")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return activeSession;
  },
});

export const createCourse = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");

    return await ctx.db.insert("courses", {
      userId: user._id,
      title: args.title,
      description: args.description,
      color: args.color,
      createdAt: Date.now(),
    });
  },
});

export const getMyCourses = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("courses")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});
