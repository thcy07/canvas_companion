# Canvas Companion

## Links

- 🎨 [Wireframe](https://wireframe.cc/U8heWA)
- 🚀 [Live App](https://adaptable-adventure-production.up.railway.app/)

## Team Members

- Cameron Samson
- Elijah Vance
- Alexis Rudy
- Jakob Hanson
- Joshua Argyle
- Kalob Rust

## Software Description

Canvas Smart Planner is an academic planning tool that syncs with Canvas via its API to automatically import a student's upcoming assignments. It uses a rule-based AI engine to prioritize tasks, estimate time requirements, and schedule focused work blocks into the student's available time. Users are kept motivated through streak tracking while the system continuously adjusts plans to ensure deadlines are met efficiently. The app supports both student and TA views, provides a monthly calendar overview, day/week planning panels, auto-generated stress-level banners, and browser push notifications for assignments due within 24 hours.

## Architecture

### Frontend

- React 18 with Vite as the build tool
- React Router v6 for client-side routing (Home, Day View, Walkthrough)
- Custom CSS (`index.css`, `App.css`) using CSS variables and Playfair Display / Lora Google Fonts
- Components: `App.jsx` (root + HomeView), `DayView.jsx`, `MonthView.jsx`, `Streak.jsx`, `Onboarding.tsx`, `Notification.tsx`, `Footer.jsx`, `Walkthrough.jsx`, `AI.jsx` (rule-based planner logic)

### Backend

- Node.js + Express
- JWT authentication (30-day tokens) with bcrypt password hashing
- AES-256-GCM encryption for stored Canvas API tokens
- `node-cron` scheduler runs every 15 minutes to check for due-soon assignments
- `web-push` for browser push notification delivery via VAPID
- Canvas API integration: paginated fetching across all active courses, TA/student role detection

### Database

- MongoDB Atlas (via Mongoose) — stores user accounts, encrypted Canvas credentials, and push subscriptions

## Software Features

Legend: ✅ = Completed   ❌ = Not completed

- ✅ Account login that saves and encrypts Canvas token
- ✅ Rule-based AI planner (`AI.jsx`) — estimates effort, scores urgency, builds Today's Plan
- ✅ AI scans and suggested priority queue with sort controls (urgency, due date, time)
- ✅ Auto-scheduled assignment plan with step-by-step suggested approach per task
- ✅ Link to Canvas — assignments include direct links to Canvas pages
- ✅ Ability to view per day, week, and month (Day View with 7/14/30-day windows + Monthly Calendar)
- ✅ Auto flags — overlapping deadlines flagged (OVERDUE, DUE_SOON, DUE_IN_3_DAYS, NO_DUE_DATE, PINNED, SUBMISSION_EXISTS)
- ✅ High-stress week detection with color-coded banners (calm / light / moderate / busy / intense)
- ✅ Completion streak display (UI implemented; real tracking is a stretch goal)
- ✅ 15-minute warning push notifications (cron runs every 15 min, notifies for assignments due within 24h)
- ✅ Browser Notifications API with VAPID-based web-push
- ✅ TA mode toggle — hides grading tasks from student plan view
- ✅ MongoDB database for user accounts and push subscriptions
- ❌ Streak tracking backed by real completion data (currently a static placeholder)
- ❌ Allow other calendars (Outlook / Google Calendar integration)
- ❌ ML that learns from gathered usage data
- ❌ Email or mobile push via Firebase Cloud Messaging

## Team Communication

The team communicates primarily via group text messages and GitHub. Pull requests, issues, and commit history are used to track progress and coordinate code changes.

## Team Responsibilities

| Responsibility                   | Team Member(s)  |
|----------------------------------|-----------------|
| Conducting Meetings              | Kalob Rust      |
| Maintaining Team Assignment List | Joshua Argyle   |
| Ensuring GitHub is Working       | Alexis Rudy     |
| Maintaining Documentation        | Cameron Samson  |
| Create & Display Presentations   | Elijah Vance    |
| Submit Team Assignments          | Jakob Hanson    |

## Reflections

The team held a retrospection meeting to review the project and identify key lessons learned.

### 3 Things That Went Well

1. **Feature scope was well-defined early.** The initial feature list closely matched what was ultimately built, making it easier to prioritize and divide work across the team.
2. **The rule-based AI planner came together effectively.** `AI.jsx` provides genuinely useful prioritization and time estimates without requiring a complex ML backend, hitting a good balance of simplicity and value.
3. **The backend auth and encryption system was implemented securely.** JWT, bcrypt, and AES-256-GCM gave the app a solid, production-ready foundation from the start.

### 3 Things That Did Not Go Well

1. **Streak tracking was left as a static placeholder.** In future projects, the team should identify which features depend on persistent state early and prioritize the data layer before building UI on top of it.
2. **Stretch features were never started.** Calendar integrations, Firebase Cloud Messaging, and ML personalization were listed but never scoped or time-boxed. Going forward, the team should be more deliberate about labeling stretch goals and deciding early whether they are realistic given the timeline.
3. **Informal communication made it hard to track decisions.** Relying heavily on group texts meant action items and blockers weren't always visible to everyone. In future projects, the team should use GitHub Issues or a shared task board more consistently.
