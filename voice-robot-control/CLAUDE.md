# CLAUDE.md - Project Context for Claude Code

## Project Overview
VoBotiq is an agentic chatbot for controlling cleaning robots (Gausium and Pudu). Operators interact through natural conversation (text or voice) and the bot autonomously fetches robot info and executes commands using OpenAI function calling. Pudu support includes clean-task control, charge/resupply/return-home/go-to-point/switch-map commands, and cleaning analytics (summary + per-session reports).

## Commands
- `npm run dev` - Start both backend (port 3001) and frontend (port 5173) concurrently
- `npm run dev:server` - Start only the Express backend (uses tsx watch)
- `npm run dev:client` - Start only the Vite frontend

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind. Chat-based UI with sidebar.
- **Backend**: Express + TypeScript. Key endpoint is `POST /api/chat` which runs an agentic tool-use loop.
- **AI**: OpenAI GPT-4o-mini with function calling for reasoning, Whisper for speech-to-text.
- **Robot API**: Gausium Cloud API at `https://openapi.gs-robot.com` (custom OAuth grant type) and Pudu Open Platform API at `https://csu-open-platform.pudutech.com` (HMAC-SHA1 signed requests, path prefix `/pudu-entry`).

## Key Files
- `server/routes/chat.ts` - The core agentic chat endpoint. Runs a loop: call OpenAI → if tool_calls, execute tools → feed results back → repeat until text response.
- `server/services/chat-tools.ts` - Tool definitions (list_robots, get_robot_status, get_site_info, send_command) and the `executeTool()` dispatcher.
- `server/services/chat-system-prompt.ts` - System prompt that defines the bot's personality and behavioral guidelines.
- `server/services/gausium-api.ts` - Gausium API client. Uses `/v1alpha1/` endpoints (not v2alpha1 which requires gRPC).
- `server/services/gausium-auth.ts` - Token management. The `open_access_key` parameter uses the AccessKeySecret, not the AccessKeyID.
- `server/services/pudu-api.ts` - Pudu API client. Uses HMAC-SHA1 signed requests (NOT Bearer). Exposes: `getPuduRobotStatus`, `getPuduTaskList`, `sendPuduCommand` (includes `trace_id`), `getPuduCleaningSummary`, `getPuduCleaningReports`, plus raw debug helpers.
- `src/hooks/useChat.ts` - Frontend conversation state. Sends full message history to `/api/chat`, handles thinking/error states.
- `src/hooks/useTTS.ts` - Browser SpeechSynthesis for voice replies.
- `src/components/chat/` - Chat UI components (MessageBubble, ChatInput, etc.)

## Environment
- `.env` must contain: `OPENAI_API_KEY`, `SERVER_PORT=3001`
- Gausium (optional): `GAUSIUM_CLIENT_ID`, `GAUSIUM_CLIENT_SECRET`, `GAUSIUM_OPEN_ACCESS_KEY`, `GAUSIUM_ROBOT_SNS`
- Pudu (optional): `PUDU_BASE_URL`, `PUDU_API_KEY`, `PUDU_APP_SECRET`, `PUDU_ROBOT_SNS` (comma-separated list of serial numbers). Optional: `PUDU_DEBUG_TASKS=0` to silence the per-task diagnostic dump.
- Use `SERVER_PORT` (not `PORT`) to avoid conflicts with Vite's preview tools which set PORT.
- If credentials are missing for a provider, its robot endpoints fall back to mock data in `test-data/robots.json`.

## Gausium API Gotchas
- Auth endpoint: `POST /gas/api/v1alpha1/oauth/token` with `grant_type: "urn:gaussian:params:oauth:grant-type:open-access-token"`
- The `open_access_key` field takes the **AccessKeySecret** value, not the AccessKeyID.
- Robot status: use `/v1alpha1/robots/{sn}/status` (JSON). The `/openapi/v2alpha1/` version requires gRPC content type.
- `getSiteInfo` may return "robot is not on a site" — the code falls back to building site info from the status response.
- Battery is at `battery.powerPercentage`, localization at `localizationInfo.localizationState` ("NORMAL" = localized).

## Pudu API Notes
- Base URL: `https://csu-open-platform.pudutech.com` (override with `PUDU_BASE_URL`). All requests are prefixed with `/pudu-entry`.
- Auth: HMAC-SHA1 signature over `x-date + method + content-type + accept + canonical-path`, using `PUDU_API_KEY` as the id and `PUDU_APP_SECRET` as the HMAC key. The helper `getPuduHeaders` in `pudu-api.ts` builds the `Authorization: hmac id=..., algorithm="hmac-sha1", headers="x-date", signature=...` header.
- Every write request includes a `trace_id` (generated with `crypto.randomUUID()`) in the JSON body for request tracing.
- **Robot ops**
  - Robot detail: `GET /cleanbot-service/v1/api/open/robot/detail?sn={sn}` — mapped by `getPuduRobotStatus`. The running task's identifying fields live at `cleanbot.clean.task.{task_id,version,name}` (not at `cleanbot.clean.name`); `PuduRobotStatus` surfaces these as `currentTask`, `currentTaskId`, `currentTaskVersion`, plus `currentReportId` from `cleanbot.clean.report_id`.
  - Task list: `GET /cleanbot-service/v1/api/open/task/list?sn={sn}` — the `mode` query param defaults to `[2]` (auto only) on the gateway side and silently hides manual (`1`) and inspection (`3`) tasks, so `getPuduTaskList` passes `mode=1&mode=2&mode=3` explicitly. Filter out `status === -1` (deleted). A task can span multiple floors via `floor_list`; match by exact map `name` (not `lv`, which is a revision counter).
  - Task exec: `POST /cleanbot-service/v1/api/open/task/exec`. Type codes:
    - `1` = charge, `3` = clean task (use `clean.status` 1=start / 3=pause / 4=cancel, plus `task_id` + `version` for start), `4` = resupply, `5` = one-key return home, `6` = go-to-point (requires `clean.point_id`), `9` = switch map (requires `clean.map_name`).
  - Pudu has no native resume — re-issue `clean.status = 1` instead.
  - `task_id` is a string. Keep it as a string everywhere — do not coerce to number.
- **Analytics** — these live under a DIFFERENT path prefix (`/data-board/v1/`) and are GET-with-query-string, not POST. They are scopable by `shop_id` only — there is no `sn_list` filter, so per-robot analytics must be fanned out or filtered client-side.
  - Cleaning summary: `GET /data-board/v1/analysis/clean/summary?start_time=&end_time=&shop_id=&clean_mode=&sub_mode=&timezone_offset=`. `start_time`/`end_time` are **unix seconds**. Data lags ~1 hour behind the robot. Surfaced via `getPuduCleaningSummary` and the `get_pudu_cleaning_summary` chat tool.
  - Cleaning reports: `GET /data-board/v1/log/clean_task/query_list?start_time=&end_time=&shop_id=&offset=&limit=&timezone_offset=`. `limit` is clamped to 1..20. Data lags ~10 minutes and max lookback is 180 days. Surfaced via `getPuduCleaningReports` and the `get_pudu_cleaning_reports` chat tool.
- **Not yet implemented** (noted gaps): webhook receiver for `robotErrorNotice` / `notifyRobotStatus` (the only way to detect Pudu localization loss — `robot/detail` does not expose it), `/cron/list` (type=10 scheduled tasks), `/map/points`, and `/map/robot/available` for discoverable `point_id` / `map_name` values.
- Pudu robots report `cleanWater` (rising tank) and `dirtyWater` (sewage tank) levels (0-100). The frontend treats `robotType === 'pudu'` as always showing water rows, via `showsWaterLevels` in `src/utils/robotCategory.ts`.
- Robot type is determined by `robotType` field in `test-data/robots.json`, by `PUDU_ROBOT_SNS`/`GAUSIUM_ROBOT_SNS` env vars, or by which credentials are configured. The chat tool `send_command` accepts an optional `manufacturer` hint to force routing, and any `PUDU_*` command type automatically routes through the Pudu executor.

## Code Style
- TypeScript strict mode
- ES modules (type: "module" in package.json)
- Server imports use `.js` extension (required for ESM with tsx)
- Tailwind for all styling, dark theme (bg-gray-900 base)
- Functional React components with hooks
