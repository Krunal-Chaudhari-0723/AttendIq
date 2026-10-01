# AttendIQ — Smart Attendance & Student Engagement System

AttendIQ verifies that a student is **really present** before marking attendance, then turns attendance and academic records into **explainable engagement scores, risk indicators and recommendations** so teachers can intervene early.

```
Live face ─▶ Campus location ─▶ Trusted attendance ─▶ Engagement score ─▶ Explainable risk ─▶ Recommendation ─▶ Early intervention
```

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 16 (App Router, client components), React 19, Tailwind CSS 4, Recharts, face-api (`@vladmandic/face-api`) |
| Backend | Node.js, Express 4, TypeScript, Mongoose 8 |
| Database | MongoDB (local or Atlas) |
| AI | Anthropic Claude API (optional) with a deterministic rule-based fallback |

---

## 1. Running locally

Prerequisites: Node.js 20+, MongoDB running locally (or an Atlas URI).

```bash
# 1. Install
npm install
npm --prefix server install

# 2. Configure (fill in the values — see the comments in each file)
cp .env.example .env.local            # NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
cp server/.env.example server/.env    # MONGODB_URI, JWT_SECRET, ...

# 3. Start both apps (two terminals)
npm run dev:server    # API  → http://localhost:5000  (seeds demo data in development)
npm run dev           # Web  → http://localhost:3000
```

Rebuild the demo database from scratch (**deletes everything** in the configured database):

```bash
npm run seed:reset:server -- --yes
```

### Demo accounts (seeded)

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@attendiq.edu | Admin@123456 |
| Teacher | sharma@attendiq.edu | Teacher@123456 |
| Teacher | patel@attendiq.edu | Teacher@123456 |
| Student | anand.student@attendiq.edu (MCA Sem 2) | Student@123456 |

All seeded students use `Student@123456`. Seeded history (six weeks of sessions, quizzes, assignments, participation and learning logs) is **demo data** and is labelled as such; seeded attendance is recorded as `MANUAL`, never as a face/location verification. Engagement, risk and recommendations are **computed** from that history, not seeded.

---

## 2. Three-minute demo script

Before the demo: sign in as **admin** → *Campus Settings* → **Use current browser coordinates** → **Save** (physical attendance is blocked until the campus is configured).

1. **Teacher** (`sharma@…`) → *Live Attendance* → choose *MCA Sem 2 / Advanced Javascript*, **Physical** → **Start attendance session**.
2. **Student** (`anand.student@…`, second browser/phone) → *Face Enrollment* (once) → *Live Attendance* → **Mark Attendance**.
3. Browser asks for **location** → server computes the distance to campus (Haversine) and checks the radius.
4. **Camera** opens → face detected and quality-checked.
5. **Liveness**: follow the random instruction (“turn your head to your LEFT/RIGHT”, then look back).
6. Server compares the face with the encrypted enrollment → **Attendance marked: PRESENT** (similarity %, distance).
7. Teacher’s **live monitor** updates within 3 s (roster, counts, verification feed).
8. Student → *Engagement*: weighted score with per-component explanation and weekly trend.
9. Teacher → *Risk Analysis*: risk level with the exact rules that fired.
10. Teacher → *Recommendations* → **Generate** → grounded recommendations, labelled **AI-generated** or **Rule-based**.

---

## 3. How it works

### Trusted attendance pipeline
```
Mark Attendance ─▶ POST /student/attendance/precheck
                    • session ACTIVE, inside its time window, for the student's own class
                    • not already marked, face enrolled, mode allowed
                    • PHYSICAL: distance(student, campus) ≤ radius and GPS accuracy ≤ limit   (computed on the server)
                    → returns a single-use attempt id + random challenge (TURN_LEFT / TURN_RIGHT), valid 3 min
camera + liveness ─▶ POST /student/attendance/verify
                    • liveness: frames start facing the camera, turn past the threshold in the
                      requested direction, return; plausible timing; one face; continuous motion
                    • identity: start/peak/end face signatures compared with the enrolled one
                    • unique index (session, student) prevents duplicates → record PRESENT / LATE
```
The browser only measures; **every decision is made on the server**. Client-supplied flags such as `matched`, `confidence` or `insideCampus` are ignored.

### Face data
* Detection, 68-point landmarks and the 128-number face signature are computed **in the browser**; camera images are never uploaded.
* Enrollment captures 3 samples; the server checks they agree, averages them and stores the result **encrypted with AES-256-GCM** (`FACE_ENCRYPTION_KEY`). Embeddings are never returned by any API.
* Match rule: Euclidean distance ≤ 0.50 (calibrated: across 210 impostor pairs the closest was 0.511).

### Engagement score (0–100) — `server/src/config/analytics.ts`
`Attendance 30% + Quiz 25% + Assignments 20% + Participation 15% + Learning activity 10%` over the last 30 days. Components without data are shown as “no data” and their weight is redistributed — never guessed. Trend compares with the score one week earlier.

### Academic risk indicator
A transparent rule set (attendance below 75 % / 60 %, attendance decline over 14 days, quiz average, assignment completion, engagement level and decline, participation). Each rule adds points and a reason; **HIGH ≥ 6, MEDIUM ≥ 3**. It is an early-support indicator, not a prediction.

### Recommendations
The server builds numbered facts from the database (no names, IDs, face or location data). With `ANTHROPIC_API_KEY` set, Claude writes recommendations that must cite those facts; uncited items are discarded and cited facts are shown verbatim. Without a key, on refusal, error or invalid output, the deterministic rule engine is used and the result is labelled **Rule-based**.

---

## 4. Security model

* JWT (HS256) in an HTTP-only cookie (and `Authorization` header); identity and role are re-read from the database on every request; tokens issued before a password change are rejected.
* Role-checked routers (`/api/admin`, `/api/teacher`, `/api/student`) plus ownership checks (teacher ↔ class/subject, student ↔ own records). The frontend route guard is cosmetic; the server is the security boundary.
* No public sign-up; accounts are created by admins. Login is rate-limited per account/IP.
* Input validation and field whitelists on every write; MongoDB `$regex` input is escaped; invalid ids return 404.
* `helmet` security headers, CORS allow-list, 256 KB body limit, generic 500 messages in production.
* Location: only the computed distance and reported accuracy are stored — never coordinates. Verification audit records expire after 30 days (TTL index).

### Known limitations (prototype)
* Face signatures are produced in the browser. A modified client could submit crafted vectors; it would still need a signature close to the victim's enrolled one, which is never exposed.
* Liveness is a head-turn challenge. It stops static photos and replayed clips; it is not certified anti-spoofing (a deepfake or a recording of the real person turning both ways could defeat it).
* Browser geolocation can be spoofed by a rooted/emulated device; the accuracy limit and radius only raise the bar.
* Rate limiting is in-memory (single instance). Use a shared store if you scale horizontally.

---

## 5. Deployment

| Part | Platform | Notes |
| --- | --- | --- |
| Frontend | Vercel | Root of the repo. Set `NEXT_PUBLIC_API_BASE_URL=https://<api>/api`. HTTPS is required for camera and location. |
| API | Render | `render.yaml` blueprint (root dir `server`, build `npm ci --include=dev && npm run build`, start `npm start`, health `/api/health`). |
| Database | MongoDB Atlas | Put the connection string in `MONGODB_URI`; allow Render's outbound IPs in Atlas network access. |

Required API variables in production: `MONGODB_URI`, `JWT_SECRET` (32+ chars), `FACE_ENCRYPTION_KEY` (64 hex), `CORS_ORIGIN` (your Vercel URL), `COOKIE_SAMESITE=none`. The server refuses to start without them. To load demo data into a fresh Atlas database run `npm run seed:reset:server -- --yes` locally with `MONGODB_URI` pointing at Atlas, or set `SEED_DEMO_DATA=true` for the first deploy.

---

## 6. Project structure

```
app/                     Next.js pages (admin/, teacher/, student/, login)
components/              UI primitives, charts, face camera, reports, risk, notifications
lib/                     API client, auth context, face engine (detection, capture, liveness)
public/models/face-api/  Face detection / landmark / recognition model weights
server/src/
  config/                env, verification thresholds, analytics weights & risk rules
  models/                Mongoose schemas
  services/              face, geo, liveness, session, engagement, risk, recommendation, report, notification
  controllers/ routes/   REST API
  utils/                 seed data, migrations, reset script
```

Quality gates: `npx tsc --noEmit` (web) · `npm --prefix server run build` (API) · `npm run build` · `npm run lint`.
