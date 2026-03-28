---
name: StudyG Learning Platform
overview: Build a full-stack virtual group study platform using React (Vite), Convex backend, BetterAuth authentication, and AI-powered quiz generation. The app enables users to create learning sessions with uploaded materials, track progress in real-time, collaborate with others via chat and shared annotations, take AI-generated quizzes, and manage revision with spaced repetition.
todos:
  - id: phase-1-scaffold
    content: "Phase 1: Create Vite + React project, install Convex + BetterAuth + Tailwind + Shadcn/ui, configure auth, build layout shell with routing (login, register, dashboard, session pages)"
    status: completed
  - id: phase-2-sessions
    content: "Phase 2: Build Convex schema for courses/sessions/materials, implement session creation form, file upload with Convex storage, material page viewer component"
    status: completed
  - id: phase-3-progress
    content: "Phase 3: Implement progress tracking mutations/queries, learning speed controls, estimated completion time, scheduled check-in functions with UI notifications"
    status: completed
  - id: phase-4-quizzes
    content: "Phase 4: Build AI quiz generation via Convex actions + OpenAI, quiz taking UI with MCQ/short answer, scoring, and performance analysis"
    status: completed
  - id: phase-5-group
    content: "Phase 5: Add group study features - invite codes, session member sidebar with real-time presence, chat system, shared annotations on materials"
    status: completed
  - id: phase-6-revision
    content: "Phase 6: Implement spaced repetition revision system, dashboard with learning stats/charts, session history page, revision queue with priority sorting"
    status: completed
isProject: false
---

# StudyG - Virtual Group Learning Companion

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS v4 + Shadcn/ui
- **Routing**: React Router v7
- **Backend**: Convex (real-time database, file storage, scheduled functions, actions)
- **Auth**: BetterAuth via `@convex-dev/better-auth`
- **AI**: OpenAI API (via Convex actions) for quiz generation and material processing

## Architecture Overview

```mermaid
graph TB
    subgraph frontend [React SPA - Vite]
        Pages[Pages and Components]
        ConvexClient[Convex React Client]
        AuthClient[BetterAuth Client]
    end

    subgraph convexBackend [Convex Backend]
        Queries[Queries - Real-time]
        Mutations[Mutations]
        Actions[Actions - AI Integration]
        Scheduler[Scheduled Functions]
        FileStorage[File Storage]
        BetterAuthComp[BetterAuth Component]
    end

    subgraph external [External Services]
        OpenAI[OpenAI API]
    end

    Pages --> ConvexClient
    Pages --> AuthClient
    ConvexClient -->|"useQuery / useMutation"| Queries
    ConvexClient --> Mutations
    AuthClient --> BetterAuthComp
    Mutations --> Scheduler
    Actions --> OpenAI
    Mutations --> FileStorage
```

## Convex Database Schema

Key tables (defined in `convex/schema.ts`):

- **courses** - subjects/courses created by users
- **chapters** - chapters within courses
- **studySessions** - core entity: learning period, scope, settings, invite code
- **sessionMembers** - users in a session with role, status, personal learning speed
- **materials** - uploaded docs/images linked to sessions (references `_storage`)
- **progress** - per-user, per-material page tracking with timestamps
- **checkIns** - periodic check-in prompts and responses during sessions
- **quizzes** - AI-generated quizzes with questions, options, explanations
- **quizAttempts** - user answers and scores per quiz
- **chatMessages** - real-time group chat within sessions
- **annotations** - shared notes on specific pages of materials
- **revisionItems** - topics flagged for review using spaced repetition scheduling
- **learningStats** - aggregated per-user statistics (streak, hours, avg score)

```mermaid
erDiagram
    studySessions ||--o{ sessionMembers : has
    studySessions ||--o{ materials : contains
    studySessions ||--o{ chatMessages : has
    studySessions ||--o{ quizzes : generates
    studySessions ||--o{ checkIns : schedules
    materials ||--o{ annotations : has
    materials ||--o{ progress : tracks
    quizzes ||--o{ quizAttempts : has
    courses ||--o{ chapters : contains
    courses ||--o{ studySessions : organizes
```

## Key Feature Implementation Details

### 1. Authentication (BetterAuth + Convex)

- Install `@convex-dev/better-auth` and `better-auth`
- Register the BetterAuth component in `convex/convex.config.ts`
- Configure auth in `convex/auth.config.ts` with email/password + social providers
- Create `src/lib/auth-client.ts` for the frontend BetterAuth client
- Wrap app with `ConvexProvider` + auth context

### 2. Study Session Creation

- Form to set: title, course, chapters/topics, start/end time, learning speed (min/page)
- Upload multiple documents/images using Convex file storage (`generateUploadUrl` pattern)
- Option to make session public or generate a private invite code for group study
- On creation, schedule periodic check-in functions via `ctx.scheduler.runAt()`

### 3. Learning Speed and Progress Tracking

- Default speed set at session creation (e.g., 3 min/page), adjustable per member
- Material viewer shows current page with navigation
- Progress auto-saves on page change via mutation
- Estimated completion time calculated from speed x remaining pages
- Real-time progress bar visible to all session members via Convex subscriptions

### 4. Periodic Check-Ins (Convex Scheduled Functions)

- When session starts, schedule check-in mutations at intervals (e.g., every 20 min)
- Each check-in triggers a UI notification asking "How's your progress?"
- User responds: on-track / struggling / ahead, with optional notes
- Responses stored and used to adjust revision priority

### 5. AI-Generated Quizzes (Convex Actions + OpenAI)

- After a session completes (or on-demand), trigger a Convex action
- Action extracts text from uploaded materials (OCR for images via OpenAI Vision, text extraction for docs)
- Sends content to OpenAI with prompt to generate quiz questions (MCQ + short answer)
- Questions tagged by topic and difficulty level
- Results stored in `quizzes` table, user attempts in `quizAttempts`
- Score analysis identifies weak areas -> feeds into revision system

### 6. Revision System (Spaced Repetition)

- After each quiz, topics where user scored poorly are flagged as `revisionItems`
- Uses a simplified SM-2 algorithm to schedule next revision date
- Dashboard shows upcoming revisions sorted by urgency
- Revision sessions re-surface materials and re-quiz on weak topics
- Critical items (repeatedly failed) get highlighted attention

### 7. Group Study (Real-Time Collaboration)

- **Join**: via invite code or public session browser
- **Progress sync**: all members' current page and status visible in a sidebar (Convex `useQuery` subscriptions)
- **Chat**: real-time text chat within the session (simple `chatMessages` table with live query)
- **Shared annotations**: members can add notes/highlights on specific pages, visible to all in real-time
- **Presence**: member status (active/idle/away) updated via heartbeat mutation

### 8. Session History and Dashboard

- All past sessions listed with stats (duration, pages covered, quiz scores)
- Aggregate stats: total hours, streak, average performance
- Visual charts for learning trends over time
- Quick access to revision queue

## Project Structure

```
StudyG/
  src/
    components/
      ui/              # Shadcn components
      auth/            # Login, Register forms
      session/         # Session creation, viewer, progress
      materials/       # Upload, page viewer
      quiz/            # Quiz taking, results
      chat/            # Group chat
      annotations/     # Shared notes overlay
      dashboard/       # Stats, history, revision queue
      layout/          # Navbar, sidebar, layout wrappers
    lib/
      auth-client.ts   # BetterAuth client config
      utils.ts         # Shared utilities
      spaced-rep.ts    # SM-2 algorithm implementation
    pages/
      HomePage.tsx
      DashboardPage.tsx
      SessionCreatePage.tsx
      SessionActivePage.tsx
      QuizPage.tsx
      RevisionPage.tsx
      SessionHistoryPage.tsx
    App.tsx
    main.tsx
  convex/
    schema.ts          # Full database schema
    convex.config.ts   # Component registration
    auth.config.ts     # BetterAuth configuration
    auth.ts            # Auth helpers
    sessions.ts        # Study session CRUD + queries
    materials.ts       # File upload + management
    progress.ts        # Progress tracking mutations/queries
    checkIns.ts        # Scheduled check-in functions
    quizzes.ts         # Quiz generation actions + storage
    chat.ts            # Chat message mutations/queries
    annotations.ts     # Annotation mutations/queries
    revision.ts        # Revision system logic
    stats.ts           # Learning stats aggregation
    crons.ts           # Recurring jobs (stats, cleanup)
  public/
  index.html
  vite.config.ts
  tailwind.config.ts
  package.json
  tsconfig.json
```

## Implementation Phases

The work is divided into 6 phases, each building on the previous:

**Phase 1** - Project scaffolding, Convex setup, BetterAuth integration, basic UI shell
**Phase 2** - Study session CRUD, material uploads, page viewer
**Phase 3** - Progress tracking, learning speed, check-in system
**Phase 4** - AI quiz generation, quiz taking UI, scoring
**Phase 5** - Group study: real-time sync, chat, shared annotations
**Phase 6** - Revision system, dashboard stats, session history, polish
