import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Courses and chapters for organizing study material
  courses: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  chapters: defineTable({
    courseId: v.id("courses"),
    userId: v.string(),
    title: v.string(),
    order: v.number(),
  })
    .index("by_course", ["courseId"])
    .index("by_user", ["userId"]),

  // Core study session entity
  studySessions: defineTable({
    creatorId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    courseId: v.optional(v.id("courses")),
    topics: v.array(v.string()),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    actualStart: v.optional(v.number()),
    actualEnd: v.optional(v.number()),
    defaultSpeedMinPerPage: v.number(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    isPublic: v.boolean(),
    inviteCode: v.optional(v.string()),
    checkInIntervalMinutes: v.number(),
    nextCheckInAt: v.optional(v.number()),
    checkInScheduledId: v.optional(v.id("_scheduled_functions")),
    totalPages: v.optional(v.number()),
  })
    .index("by_creator", ["creatorId"])
    .index("by_invite_code", ["inviteCode"])
    .index("by_status", ["status"]),

  // Members of a study session
  sessionMembers: defineTable({
    sessionId: v.id("studySessions"),
    userId: v.string(),
    userName: v.string(),
    userEmail: v.string(),
    userImage: v.optional(v.string()),
    avatarColor: v.optional(v.string()),
    role: v.union(v.literal("host"), v.literal("member")),
    status: v.union(
      v.literal("active"),
      v.literal("idle"),
      v.literal("away"),
      v.literal("offline")
    ),
    speedMinPerPage: v.number(),
    currentMaterialId: v.optional(v.id("materials")),
    currentPage: v.number(),
    lastHeartbeat: v.number(),
    joinedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_session_user", ["sessionId", "userId"]),

  // Uploaded documents/images
  materials: defineTable({
    sessionId: v.id("studySessions"),
    uploadedBy: v.string(),
    title: v.string(),
    type: v.union(v.literal("document"), v.literal("image"), v.literal("pdf")),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    totalPages: v.optional(v.number()),
    startPage: v.optional(v.number()),
    endPage: v.optional(v.number()),
    order: v.number(),
    extractedText: v.optional(v.string()),
    uploadedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_uploader", ["uploadedBy"]),

  // Per-user page-level progress within a material
  progress: defineTable({
    sessionId: v.id("studySessions"),
    materialId: v.id("materials"),
    userId: v.string(),
    currentPage: v.number(),
    totalPages: v.number(),
    pagesVisited: v.array(v.number()),
    startedAt: v.number(),
    lastUpdatedAt: v.number(),
    completedAt: v.optional(v.number()),
    timeSpentSeconds: v.number(),
  })
    .index("by_session_user", ["sessionId", "userId"])
    .index("by_material_user", ["materialId", "userId"])
    .index("by_user", ["userId"]),

  // Periodic check-in prompts and responses
  checkIns: defineTable({
    sessionId: v.id("studySessions"),
    userId: v.string(),
    promptedAt: v.number(),
    respondedAt: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("on_track"),
      v.literal("struggling"),
      v.literal("ahead")
    ),
    notes: v.optional(v.string()),
    currentPage: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_user", ["sessionId", "userId"])
    .index("by_user", ["userId"]),

  // AI-generated quizzes per session
  quizzes: defineTable({
    sessionId: v.id("studySessions"),
    materialId: v.optional(v.id("materials")),
    generatedAt: v.number(),
    topic: v.optional(v.string()),
    questions: v.array(
      v.object({
        id: v.string(),
        type: v.union(v.literal("mcq"), v.literal("short_answer")),
        question: v.string(),
        options: v.optional(v.array(v.string())),
        correctAnswer: v.string(),
        explanation: v.string(),
        topic: v.string(),
        difficulty: v.union(
          v.literal("easy"),
          v.literal("medium"),
          v.literal("hard")
        ),
      })
    ),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("failed")
    ),
  })
    .index("by_session", ["sessionId"])
    .index("by_material", ["materialId"]),

  // User attempts at quizzes
  quizAttempts: defineTable({
    quizId: v.id("quizzes"),
    sessionId: v.id("studySessions"),
    userId: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    answers: v.array(
      v.object({
        questionId: v.string(),
        userAnswer: v.string(),
        isCorrect: v.boolean(),
        timeSpentSeconds: v.optional(v.number()),
      })
    ),
    score: v.optional(v.number()),
    totalQuestions: v.number(),
    correctAnswers: v.optional(v.number()),
    weakTopics: v.optional(v.array(v.string())),
  })
    .index("by_quiz", ["quizId"])
    .index("by_session_user", ["sessionId", "userId"])
    .index("by_user", ["userId"]),

  // Real-time group chat messages
  chatMessages: defineTable({
    sessionId: v.id("studySessions"),
    userId: v.string(),
    userName: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("text"),
      v.literal("system"),
      v.literal("progress_update")
    ),
    sentAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_time", ["sessionId", "sentAt"]),

  // Shared annotations on materials
  annotations: defineTable({
    materialId: v.id("materials"),
    sessionId: v.id("studySessions"),
    userId: v.string(),
    userName: v.string(),
    page: v.number(),
    content: v.string(),
    highlightText: v.optional(v.string()),
    color: v.optional(v.string()),
    isShared: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_material", ["materialId"])
    .index("by_material_page", ["materialId", "page"])
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  // Spaced repetition revision items
  revisionItems: defineTable({
    userId: v.string(),
    topic: v.string(),
    sourceSessionId: v.id("studySessions"),
    sourceQuizId: v.optional(v.id("quizzes")),
    difficulty: v.number(),
    interval: v.number(),
    repetitions: v.number(),
    easeFactor: v.number(),
    nextReviewAt: v.number(),
    lastReviewedAt: v.optional(v.number()),
    isCritical: v.boolean(),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_next_review", ["userId", "nextReviewAt"])
    .index("by_user_topic", ["userId", "topic"]),

  // Aggregated per-user learning stats
  learningStats: defineTable({
    userId: v.string(),
    totalSessionsCompleted: v.number(),
    totalPagesRead: v.number(),
    totalTimeMinutes: v.number(),
    currentStreak: v.number(),
    longestStreak: v.number(),
    lastStudyDate: v.optional(v.number()),
    averageQuizScore: v.number(),
    totalQuizzesAttempted: v.number(),
    weeklyGoalMinutes: v.number(),
    weeklyMinutesThisWeek: v.number(),
  }).index("by_user", ["userId"]),

  // Daily activity records for charts
  activityLogs: defineTable({
    userId: v.string(),
    date: v.string(),
    minutesStudied: v.number(),
    pagesRead: v.number(),
    sessionsCompleted: v.number(),
    quizzesTaken: v.number(),
    averageScore: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),
});
