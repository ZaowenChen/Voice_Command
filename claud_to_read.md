# Voice Command Robot Control — Web App (Desktop-First)

## Project Overview

A web application (React + Node.js) that lets cleaners/operators control Gausium cleaning robots via voice commands. Runs in a browser on your computer for development, later deployable as a mobile web app or wrapped in a native shell.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React + TypeScript + Vite | Fast dev, runs in browser |
| **Voice Capture** | Browser Web Audio API (`MediaRecorder`) | Access mic from browser |
| **Speech-to-Text** | OpenAI Whisper API (`/v1/audio/transcriptions`) | Best accuracy, simple API |
| **Intent Parsing** | OpenAI GPT-4o-mini (structured output) | Parse natural language → robot command JSON |
| **Backend Proxy** | Node.js + Express | Hides API keys, proxies Gausium API calls |
| **Styling** | Tailwind CSS | Fast UI prototyping |

---

## System Flow

```
┌─────────────┐     audio blob      ┌──────────────┐
│  Browser    │ ──────────────────► │  Node.js     │
│  (React)    │                     │  Backend     │
│             │     transcript      │              │
│  Mic button │ ◄────────────────── │  /api/voice  │──► OpenAI Whisper
│  Robot UI   │                     │              │
│             │     command JSON    │              │
│             │ ◄────────────────── │  /api/parse  │──► GPT-4o-mini
│             │                     │              │
│             │     robot response  │              │
│             │ ◄────────────────── │  /api/robot/*│──► Gausium Cloud API
└─────────────┘                     └──────────────┘
```

---

## Gausium API Reference (Key Endpoints)

**Base:** `https://openapi.gs-robot.com`

### Auth
```
POST /gas/api/v1alpha1/oauth/token
Body: { grant_type, client_id, client_secret, open_access_key }
Returns: { access_token, refresh_token, expires_in }
```

### List Robots
```
GET /v1alpha1/robots?page=1&pageSize=10&relation=contract
Header: Authorization: Bearer {token}
Returns: { robots: [{ serialNumber, displayName, modelTypeCode, online }] }
```

### Get Robot Status (S-series)
```
GET /openapi/v2alpha1/robots/{sn}/status
Returns: battery level, localization state, current task, position
```

### Get Site Info
```
GET /openapi/v2alpha1/robots/{sn}/getSiteInfo
Returns: { buildings: [{ floors: [{ maps: [{ id, name }] }] }] }
```

### Send Command
```
POST /v1alpha1/robots/{sn}/commands
Body varies by command type — see command table below
```

### Command Types

| Command | Body Shape |
|---|---|
| Start task | `{ serialNumber, remoteTaskCommandType: "START_TASK", commandParameter: { startTaskParameter: { cleaningMode, task: { map, name, loop, loopCount } } } }` |
| Pause task | `{ serialNumber, remoteTaskCommandType: "PAUSE_TASK" }` |
| Resume task | `{ serialNumber, remoteTaskCommandType: "RESUME_TASK" }` |
| Stop task | `{ serialNumber, remoteTaskCommandType: "STOP_TASK" }` |
| Navigate to point | `{ serialNumber, remoteNavigationCommandType: "CROSS_NAVIGATE", commandParameter: { startNavigationParameter: { map, position } } }` |
| Pause navigation | `{ serialNumber, remoteNavigationCommandType: "PAUSE_NAVIGATE", commandParameter: { startNavigationParameter: { map, position } } }` |
| Stop navigation | `{ serialNumber, remoteNavigationCommandType: "STOP_NAVIGATE", ... }` |

---

## Project Structure

```
voice-robot-control/
├── package.json
├── .env                              # API keys (gitignored)
│
├── server/                           # Node.js backend
│   ├── index.ts                      # Express server entry
│   ├── routes/
│   │   ├── voice.ts                  # POST /api/voice — audio → Whisper → transcript
│   │   ├── parse.ts                  # POST /api/parse — transcript → GPT → command JSON
│   │   └── robot.ts                  # Proxy routes to Gausium API
│   ├── services/
│   │   ├── openai.ts                 # Whisper transcription + GPT intent parsing
│   │   ├── gausium-auth.ts           # OAuth token management (get/refresh/cache)
│   │   └── gausium-api.ts            # Typed Gausium API client
│   └── types/
│       └── index.ts                  # Shared types
│
├── src/                              # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── RobotSelector.tsx         # Dropdown: pick robot by SN
│   │   ├── RobotStatusPanel.tsx      # Battery, localization, current task
│   │   ├── LocalizationWarning.tsx   # Red banner if not localized
│   │   ├── TaskList.tsx              # Available cleaning tasks on current map
│   │   ├── NavigationPoints.tsx      # Available navigation positions
│   │   ├── VoiceButton.tsx           # Hold-to-talk mic button
│   │   ├── TranscriptDisplay.tsx     # Shows what was heard
│   │   ├── CommandConfirmation.tsx   # Parsed command + result
│   │   └── CommandHistory.tsx        # Log of recent commands
│   ├── hooks/
│   │   ├── useAudioRecorder.ts       # MediaRecorder → audio blob
│   │   ├── useRobotStatus.ts         # Polls robot status
│   │   └── useVoiceCommand.ts        # Orchestrates full voice pipeline
│   ├── services/
│   │   └── api.ts                    # fetch wrapper for backend
│   └── types/
│       └── index.ts
│
└── test-data/
    └── robots.json                   # Hardcoded test robots for dev
```

---

## .env File

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Gausium
GAUSIUM_CLIENT_ID=your_client_id
GAUSIUM_CLIENT_SECRET=your_client_secret
GAUSIUM_OPEN_ACCESS_KEY=your_access_key

# Server
PORT=3001
```

---

## GPT Intent Parsing Prompt

Used in `server/services/openai.ts`:

```
You are a robot command parser for Gausium cleaning robots.

Given a voice transcript from an operator, return a JSON object with the command to execute.

Available context:
- Current robot SN: {serialNumber}
- Current map: {currentMapName} (ID: {currentMapId})
- Available tasks on this map: {taskList}
- Available navigation points: {positionList}

Return ONLY valid JSON:
{
  "intent": "start_task" | "stop_task" | "pause_task" | "resume_task" | 
            "navigate" | "stop_navigate" | "pause_navigate" | 
            "status" | "unknown",
  "confidence": 0.0-1.0,
  "parameters": {
    "taskName": "optional - matched task name from list",
    "mapId": "optional",
    "position": "optional - matched navigation point from list",
    "cleaningMode": "optional"
  },
  "confirmationMessage": "Human-readable summary of what will happen"
}

Match task/position names fuzzy — e.g. "clean area A" should match 
"execute_task_a" from the task list. If ambiguous, set intent to "unknown".
```

---

## UI Layout

```
┌─────────────────────────────────────────────────┐
│  🤖 Robot Voice Control                         │
├──────────────────┬──────────────────────────────┤
│  Select Robot    │   Robot Status               │
│  [▼ Scrubber-L ] │   🔋 Battery: 75%            │
│                  │   📍 Map: Floor-2             │
│                  │   ⚙️ Status: Idle             │
│                  │                              │
│                  │   ⚠️ ROBOT NOT LOCALIZED      │
│                  │   (red banner, shown if true) │
├──────────────────┴──────────────────────────────┤
│  Available Tasks          Navigation Points     │
│  ┌──────────────┐        ┌──────────────┐       │
│  │ ▶ Task A     │        │ 📍 Lobby     │       │
│  │ ▶ Task B     │        │ 📍 Charger   │       │
│  │ ▶ Full Clean │        │ 📍 Elevator  │       │
│  └──────────────┘        └──────────────┘       │
├─────────────────────────────────────────────────┤
│              🎙️ [ Hold to Talk ]                 │
│                                                 │
│  "Clean area A on floor 2"                      │
│  → START_TASK: Task A on Floor-2  ✅ Accepted    │
├─────────────────────────────────────────────────┤
│  History                                        │
│  10:32  Start Task A           ✅                │
│  10:28  Navigate to Lobby      ✅                │
│  10:15  Stop Task              ✅                │
└─────────────────────────────────────────────────┘
```

---

## Implementation Phases (for Claude Code)

### Phase 1 — Project Bootstrap
1. Vite + React + TypeScript frontend (port 5173)
2. Express + TypeScript backend (port 3001) using tsx
3. Single package.json, `npm run dev` runs both concurrently
4. .env loading, CORS, test-data/robots.json with 3 fake robots
5. `GET /api/robots` returns test data
6. RobotSelector dropdown on frontend

### Phase 2 — Gausium API Integration
7. `gausium-auth.ts` — token fetch/refresh/cache
8. `gausium-api.ts` — listRobots, getRobotStatus, getSiteInfo, sendCommand
9. Backend proxy routes under `/api/robot/*`
10. Fallback to test data when no Gausium credentials

### Phase 3 — Robot Status UI
11. RobotStatusPanel — battery %, map name, task state
12. LocalizationWarning — red banner when not localized
13. TaskList — show available tasks from site/map info
14. NavigationPoints — show available positions
15. Auto-poll status every 10 seconds

### Phase 4 — Voice Pipeline
16. useAudioRecorder — browser mic → WebM blob
17. POST /api/voice — blob → Whisper → transcript
18. POST /api/parse — transcript + robot context → GPT → command JSON
19. VoiceButton (hold-to-talk) + TranscriptDisplay + CommandConfirmation

### Phase 5 — Command Execution
20. Wire parsed intent → correct Gausium command body → POST /api/robot/:sn/commands
21. Show confirmation + result in UI
22. CommandHistory log
23. Error handling for rejected/failed commands

### Phase 6 — Polish
24. Sound/visual feedback on command sent
25. TTS readback of confirmation
26. Better loading states
27. Graceful token expiry handling

---

## Claude Code Session Starters

### Session 1: Bootstrap
```
Create a project called "voice-robot-control":
- Vite + React + TypeScript frontend on port 5173
- Express + TypeScript backend on port 3001 (use tsx for dev)
- concurrently to run both with "npm run dev"
- Tailwind CSS configured
- .env with OPENAI_API_KEY, GAUSIUM_CLIENT_ID, GAUSIUM_CLIENT_SECRET, GAUSIUM_OPEN_ACCESS_KEY, PORT=3001
- CORS allowing localhost:5173
- test-data/robots.json with 3 test robots:
  [
    { "serialNumber": "TEST00-0000-000-S001", "displayName": "Scrubber-Lobby", "modelTypeCode": "Scrubber 75", "online": true },
    { "serialNumber": "TEST00-0000-000-S002", "displayName": "Scrubber-Floor2", "modelTypeCode": "Scrubber 50", "online": true },
    { "serialNumber": "TEST00-0000-000-S003", "displayName": "Vacuum-Main", "modelTypeCode": "Phantas", "online": false }
  ]
- GET /api/robots returns this list
- Frontend: RobotSelector dropdown + RobotStatusPanel (mock data for now)
- Show a red LocalizationWarning banner (toggleable for testing)
```

### Session 2: Gausium API + Status
```
Continuing voice-robot-control, add Gausium API integration:
1. server/services/gausium-auth.ts — POST to https://openapi.gs-robot.com/gas/api/v1alpha1/oauth/token with { grant_type: "urn:gaussian:params:oauth:grant-type:open-access-token", client_id, client_secret, open_access_key }. Cache token, refresh before expiry.
2. server/services/gausium-api.ts — listRobots(), getRobotStatus(sn), getSiteInfo(sn), sendCommand(sn, commandBody)
3. Routes: GET /api/robots, GET /api/robots/:sn/status, GET /api/robots/:sn/site, POST /api/robots/:sn/commands
4. If GAUSIUM_CLIENT_ID is empty, return mock data instead of calling real API
5. Frontend: after selecting robot, fetch status + site info, display battery/localization/available tasks+positions
```

### Session 3: Voice Pipeline
```
Add voice commands to voice-robot-control:
1. useAudioRecorder hook — uses navigator.mediaDevices.getUserMedia + MediaRecorder, returns { isRecording, startRecording, stopRecording, audioBlob }
2. POST /api/voice — accepts multipart form with audio file, sends to OpenAI Whisper API (model: whisper-1), returns { transcript }
3. POST /api/parse — accepts { transcript, context: { serialNumber, currentMap, availableTasks, availablePositions } }, sends to GPT-4o-mini with system prompt that returns structured JSON { intent, confidence, parameters, confirmationMessage }
4. VoiceButton component — big circular mic button, hold to record, release to process
5. useVoiceCommand hook — orchestrates: record → /api/voice → /api/parse → execute command via /api/robots/:sn/commands
6. Show transcript, parsed command, and execution result in the UI
```