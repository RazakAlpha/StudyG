# StudyG - Virtual Group Learning Companion

A full-stack virtual group study platform built with **React (Vite)**, **Convex**, **BetterAuth**, and **OpenAI**.

## Features

- **Learning Sessions** - Set scope, schedule, topics, reading speed
- **File Upload** - Upload documents and images as study materials
- **Real-time Progress** - Track your page-by-page reading progress
- **Group Study** - Join sessions via invite code, see members' progress live
- **Group Chat** - Real-time chat within study sessions
- **Shared Annotations** - Add notes on specific pages, visible to all
- **Check-in System** - Periodic prompts to report your progress status
- **AI Quizzes** - Post-session AI-generated questions (MCQ + short answer)
- **Spaced Repetition** - SM-2 algorithm for revision scheduling
- **Dashboard** - Stats, activity chart, weekly goal, revision queue

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Styling**: Tailwind CSS v4 + Radix UI primitives
- **Routing**: React Router v7
- **Backend**: Convex (real-time database, file storage, scheduled functions)
- **Auth**: BetterAuth via `@convex-dev/better-auth`
- **AI**: OpenAI GPT-4o-mini for quiz generation

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

Follow the prompts to create a new Convex project. This will generate the `convex/_generated/` folder.

### 3. Set Environment Variables

In the Convex dashboard, add:
- `BETTER_AUTH_SECRET` - A random secret string (min 32 chars)
- `SITE_URL` - Your frontend URL (e.g., `http://localhost:5173`)
- `OPENAI_API_KEY` - Your OpenAI API key
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (optional, for Google OAuth)

Update `.env.local`:
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

### 4. Run the App

In one terminal:
```bash
npx convex dev
```

In another terminal:
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
StudyG/
  src/
    components/
      annotations/     # Shared notes on materials
      chat/            # Group real-time chat
      layout/          # App shell with sidebar
      materials/       # Upload + page viewer
      session/         # Members panel, check-in modal
    hooks/             # Custom React hooks
    lib/               # Auth client, utilities
    pages/             # Route page components
  convex/
    schema.ts          # Full DB schema
    sessions.ts        # Session CRUD + real-time queries
    materials.ts       # File upload + management
    progress.ts        # Progress tracking
    checkIns.ts        # Scheduled periodic check-ins
    quizzes.ts         # AI quiz generation
    chat.ts            # Real-time messaging
    annotations.ts     # Page annotations
    revision.ts        # Spaced repetition (SM-2)
    stats.ts           # Learning analytics
```

## How Quiz Generation Works

1. After a session (or on demand), click **Quiz Me**
2. A Convex action fetches extracted text from uploaded materials
3. Text is sent to OpenAI GPT-4o-mini with a structured prompt
4. 8 questions generated (5 MCQ + 3 short answer) with difficulty tags
5. Results stored in Convex, user attempts scored and analyzed
6. Weak topics automatically added to the spaced repetition revision queue

## Invite Code System

- Private sessions generate a 6-character alphanumeric code
- Share link: `your-domain.com/join/XXXXXX`
- Members join and get access to all session materials and chat
