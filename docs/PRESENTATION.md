# StudyG - Virtual Group Learning Companion

## Presentation Guide

This document contains speaker notes and slide content for creating a PowerPoint presentation about StudyG.

---

## Slide 1: Title Slide

**Title:** StudyG - Virtual Group Learning Companion

**Subtitle:** Learn Together, Track Progress, Achieve More

**Speaker Notes:**
- Introduce StudyG as a modern study companion application
- Target audience: Students who want to enhance their learning experience
- Key value proposition: Collaborative learning with progress tracking

---

## Slide 2: The Problem

**Content:**
- Students often study alone and lack accountability
- No way to track if they're actually learning or just passively reading
- Group study sessions are difficult to coordinate
- Hard to measure progress across study materials
- No personalized feedback on understanding

**Speaker Notes:**
- Many students struggle with self-directed learning
- Passive reading doesn't guarantee comprehension
- Finding and coordinating study groups is time-consuming
- Traditional methods offer no insight into learning effectiveness

---

## Slide 3: Our Solution

**Content:**
- Virtual study groups with real-time collaboration
- Per-page time tracking to verify active learning
- Scheduled check-ins to keep students accountable
- AI-powered quizzes and feedback
- Spaced repetition for long-term retention

**Speaker Notes:**
- StudyG addresses all these pain points with a comprehensive platform
- The platform combines social learning with personal accountability
- Real-time features create a "study buddy" experience online
- AI enhances learning without replacing human interaction

---

## Slide 4: Key Features Overview

**Content:**
1. **Virtual Study Groups**
   - Create or join sessions with invite codes
   - See members' real-time progress
   - Host controls for session management

2. **Page Time Tracking**
   - Tracks time spent on each page
   - Verifies active engagement with material
   - Progress synced across all group members

3. **Smart Check-ins**
   - Periodic prompts during study sessions
   - Self-report: on-track, struggling, or ahead
   - Optional notes for context

4. **AI-Powered Learning**
   - Auto-generated quizzes from materials
   - AI tutor for concept explanation
   - Flashcard generation
   - Session summaries

5. **Spaced Repetition**
   - SM-2 algorithm implementation
   - Personalized revision queue
   - Weak topics automatically identified

**Speaker Notes:**
- Walk through each feature briefly
- Emphasize the real-time nature of group learning
- Highlight how AI reduces friction in study prep

---

## Slide 5: How It Works - Creating a Session

**Content:**
1. Create a new study session
   - Set title, description, topics
   - Choose public or private visibility
   - Set reading speed (min/page)
   - Configure check-in intervals

2. Upload study materials
   - Support for PDFs and images
   - Automatic text extraction
   - Add to session library

3. Share invite code
   - 6-character unique code
   - Share URL with friends
   - Others join seamlessly

**Speaker Notes:**
- Demo the session creation flow
- Show how materials are uploaded and processed
- Explain the invite code system

---

## Slide 6: How It Works - During a Session

**Content:**
- **Material Viewer**
  - Page-by-page navigation
  - Zoom and scroll controls
  - Annotation toggle

- **Real-time Chat**
  - Group messaging
  - System notifications for joins/events
  - Progress updates

- **Members Panel**
  - See who's online (active/idle/away)
  - View each member's current position
  - Reading speed settings

- **Progress Timeline**
  - Visual timeline of all members
  - Color-coded by member
  - Shows position and pace

- **Check-in Modal**
  - Appears at scheduled intervals
  - Report status with optional note
  - Helps track understanding

**Speaker Notes:**
- This is the core user experience
- Show how all panels work together
- Emphasize real-time synchronization

---

## Slide 7: Technology Stack

**Content:**
- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Convex (real-time database & serverless)
- **Authentication:** BetterAuth
- **Styling:** Tailwind CSS + Radix UI
- **AI:** OpenAI GPT-4o-mini
- **Routing:** React Router v7
- **Charts:** Recharts
- **File Storage:** Convex Storage

**Speaker Notes:**
- Modern, performant stack
- Convex provides real-time out of the box
- BetterAuth handles secure authentication
- OpenAI enables smart features without custom ML

---

## Slide 8: Architecture Overview

**Content:**
```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │Dashboard │  │ Session  │  │   Quiz   │  │Revision │ │
│  │  Page    │  │  Active  │  │  Page    │  │  Page   │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ Real-time subscriptions
┌────────────────────────▼────────────────────────────────┐
│                  Convex Backend                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐  │
│  │Sessions │  │Progress │  │ CheckIns│  │   Chat     │  │
│  │ & Members│ │ Tracking│  │         │  │            │  │
│  └─────────┘  └─────────┘  └─────────┘  └────────────┘  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐  │
│  │Quizzes  │  │Revision │  │   AI    │  │  Stats     │  │
│  │         │  │ (SM-2)  │  │ Actions │  │            │  │
│  └─────────┘  └─────────┘  └─────────┘  └────────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Convex Database & File Storage           │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Speaker Notes:**
- Explain the client-server architecture
- Convex handles both database and real-time subscriptions
- All queries automatically sync across clients
- Serverless functions handle business logic

---

## Slide 9: Database Schema

**Content:**
| Table | Purpose |
|-------|---------|
| `studySessions` | Core session entity with status, invite codes |
| `sessionMembers` | User membership with role, status, position |
| `materials` | Uploaded documents with extracted text |
| `progress` | Per-user page-level progress tracking |
| `checkIns` | Scheduled prompts and responses |
| `quizzes` | AI-generated quiz questions |
| `quizAttempts` | User attempts with scoring |
| `chatMessages` | Real-time session chat |
| `annotations` | Shared page notes |
| `revisionItems` | Spaced repetition items (SM-2) |
| `learningStats` | Aggregated user statistics |
| `activityLogs` | Daily activity for charts |

**Speaker Notes:**
- Normalized schema for flexibility
- Progress tracking at page level enables granular analytics
- Revision items store SM-2 algorithm state

---

## Slide 10: Real-Time Features

**Content:**
- **Live Progress Sync**
  - All members see each other's position
  - Updates in real-time via Convex subscriptions

- **Presence System**
  - Heartbeat every 30 seconds
  - Status: active, idle, away, offline
  - Visual indicators in UI

- **Instant Chat**
  - Messages appear immediately
  - System notifications for events
  - No page refresh needed

- **Dynamic Check-ins**
  - Scheduled during active sessions
  - Auto-cancelled on pause/end
  - Response collection in real-time

**Speaker Notes:**
- Convex provides automatic real-time subscriptions
- No WebSocket management required
- Heartbeat ensures accurate presence

---

## Slide 11: AI Features

**Content:**
1. **Quiz Generation**
   - 5 MCQ + 3 short answer per session
   - Based on uploaded materials
   - Immediate feedback on submission

2. **AI Tutor**
   - Explain any concept
   - Multi-turn conversation
   - Context-aware responses

3. **Flashcards**
   - Auto-generated from material
   - Key topics extraction
   - Add to revision queue

4. **Session Summary**
   - End-of-session overview
   - Topics covered
   - Performance metrics

**Speaker Notes:**
- All AI via OpenAI GPT-4o-mini
- Server-side calls keep API key secure
- Structured prompts ensure consistent quality

---

## Slide 12: Spaced Repetition (SM-2)

**Content:**
- **Algorithm:** Modified SM-2 for optimal retention
- **Quality Ratings:** 0-5 scale after each review
- **Interval Calculation:**
  - Quality < 3: Reset to 1 day
  - Quality >= 3: Interval × Ease Factor
  - Ease Factor adjusts based on performance

- **Workflow:**
  1. Take quiz
  2. Weak topics → revision queue
  3. Daily review of due items
  4. Rate quality → next review date

**Speaker Notes:**
- SM-2 is proven science for long-term retention
- Automatically prioritizes weak areas
- Distributed practice over massed practice

---

## Slide 13: User Dashboard

**Content:**
- **Activity Overview**
  - 14-day activity chart
  - Study streak counter
  - Weekly goal progress

- **Active Sessions**
  - Your current sessions
  - Quick join for public groups

- **Upcoming Reviews**
  - Items due for revision
  - Quick access to study queue

- **Recent Sessions**
  - Session history
  - View past performance

**Speaker Notes:**
- Dashboard is the home base for students
- At-a-glance view of all learning activity
- Quick actions for common tasks

---

## Slide 14: User Flow - Joining a Study Group

**Content:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Receive    │ ──► │  Open URL   │ ──► │   Authenticate │
│  Invite URL │     │ /join/ABC123 │     │   (if needed)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Chat &    │ ◄── │   View &    │ ◄── │    Start     │
│   Progress  │     │   Study     │     │   Studying   │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Speaker Notes:**
- Simple 4-step flow to join
- No account required until joining
- Auth can be deferred to first session

---

## Slide 15: Security & Authentication

**Content:**
- **BetterAuth Implementation**
  - Email/password authentication
  - Google OAuth option
  - JWT session management
  - Cross-domain session support

- **Authorization**
  - Role-based: host vs. member
  - Session-level permissions
  - Private session access control

- **Data Security**
  - API keys server-side only
  - Signed URLs for file access
  - Input validation on all mutations

**Speaker Notes:**
- Security is built into the auth framework
- Minimal security overhead for features
- Focus on user experience

---

## Slide 16: Future Enhancements

**Content:**
- **Video/Audio Sessions**
  - Synchronous study with webcam
  - Voice chat during sessions

- **Advanced Analytics**
  - Learning style detection
  - Personalized recommendations
  - Cohort comparisons

- **Integrations**
  - Notion, Obsidian export
  - Anki flashcard sync
  - Calendar integration

- **Gamification**
  - Achievements and badges
  - Leaderboards
  - Study streaks rewards

**Speaker Notes:**
- Platform has solid foundation for expansion
- Real-time infrastructure supports multimedia
- Community features can drive engagement

---

## Slide 17: Key Takeaways

**Content:**
1. **Collaborative Learning** - Study with others, stay motivated
2. **Accountability** - Check-ins ensure you're actually learning
3. **Real-time Sync** - See group progress instantly
4. **AI Assistance** - Quizzes, flashcards, tutoring on-demand
5. **Proven Methods** - Spaced repetition for lasting knowledge

**Speaker Notes:**
- Reinforce the core value propositions
- Emphasize the combination of social + personal learning
- Highlight that it's more than just a study tracker

---

## Slide 18: Thank You / Q&A

**Content:**
- **StudyG** - Learn Together, Track Progress, Achieve More

- **Links:**
  - Website: studyG.app
  - GitHub: github.com/studyG
  - Contact: support@studyG.app

**Speaker Notes:**
- Open floor for questions
- Demo available if time permits
- Thank audience for their time

---

## Speaker Notes Format

Each slide includes:
- **Title:** Slide header
- **Content:** Bullet points for slide
- **Speaker Notes:** Detailed talking points

## Slide Creation Tips

1. **Keep text minimal** - Use keywords, not full sentences
2. **Visual aids** - Include screenshots or diagrams where noted
3. **Practice timing** - Aim for ~2 minutes per slide
4. **Engage audience** - Ask questions, encourage interaction

## Color Scheme Recommendation

- **Primary:** Indigo (#6366F1)
- **Secondary:** Purple (#8B5CF6)
- **Accent:** Emerald (#10B981)
- **Background:** Slate (#1E293B) for dark, White (#FFFFFF) for light
- **Text:** Slate-900 for dark backgrounds, Slate-700 for light

## Font Recommendations

- **Titles:** Inter Bold (or sans-serif bold)
- **Body:** Inter Regular
- **Code/Data:** JetBrains Mono (monospace)
