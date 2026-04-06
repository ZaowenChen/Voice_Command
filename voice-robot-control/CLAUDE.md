# CLAUDE.md - Project Context for Claude Code

## Project Overview
VoBotiq is an agentic chatbot for controlling Gausium cleaning robots. Operators interact through natural conversation (text or voice) and the bot autonomously fetches robot info and executes commands using OpenAI function calling.

## Commands
- `npm run dev` - Start both backend (port 3001) and frontend (port 5173) concurrently
- `npm run dev:server` - Start only the Express backend (uses tsx watch)
- `npm run dev:client` - Start only the Vite frontend

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind. Chat-based UI with sidebar.
- **Backend**: Express + TypeScript. Key endpoint is `POST /api/chat` which runs an agentic tool-use loop.
- **AI**: OpenAI GPT-4o-mini with function calling for reasoning, Whisper for speech-to-text.
- **Robot API**: Gausium Cloud API at `https://openapi.gs-robot.com`. Auth uses a custom OAuth grant type.

## Key Files
- `server/routes/chat.ts` - The core agentic chat endpoint. Runs a loop: call OpenAI → if tool_calls, execute tools → feed results back → repeat until text response.
- `server/services/chat-tools.ts` - Tool definitions (list_robots, get_robot_status, get_site_info, send_command) and the `executeTool()` dispatcher.
- `server/services/chat-system-prompt.ts` - System prompt that defines the bot's personality and behavioral guidelines.
- `server/services/gausium-api.ts` - Gausium API client. Uses `/v1alpha1/` endpoints (not v2alpha1 which requires gRPC).
- `server/services/gausium-auth.ts` - Token management. The `open_access_key` parameter uses the AccessKeySecret, not the AccessKeyID.
- `src/hooks/useChat.ts` - Frontend conversation state. Sends full message history to `/api/chat`, handles thinking/error states.
- `src/hooks/useTTS.ts` - Browser SpeechSynthesis for voice replies.
- `src/components/chat/` - Chat UI components (MessageBubble, ChatInput, etc.)

## Environment
- `.env` must contain: `OPENAI_API_KEY`, `GAUSIUM_CLIENT_ID`, `GAUSIUM_CLIENT_SECRET`, `GAUSIUM_OPEN_ACCESS_KEY`, `SERVER_PORT=3001`
- Use `SERVER_PORT` (not `PORT`) to avoid conflicts with Vite's preview tools which set PORT.
- If Gausium credentials are missing, all robot endpoints fall back to mock data in `test-data/robots.json`.

## Gausium API Gotchas
- Auth endpoint: `POST /gas/api/v1alpha1/oauth/token` with `grant_type: "urn:gaussian:params:oauth:grant-type:open-access-token"`
- The `open_access_key` field takes the **AccessKeySecret** value, not the AccessKeyID.
- Robot status: use `/v1alpha1/robots/{sn}/status` (JSON). The `/openapi/v2alpha1/` version requires gRPC content type.
- `getSiteInfo` may return "robot is not on a site" — the code falls back to building site info from the status response.
- Battery is at `battery.powerPercentage`, localization at `localizationInfo.localizationState` ("NORMAL" = localized).

## Code Style
- TypeScript strict mode
- ES modules (type: "module" in package.json)
- Server imports use `.js` extension (required for ESM with tsx)
- Tailwind for all styling, dark theme (bg-gray-900 base)
- Functional React components with hooks
