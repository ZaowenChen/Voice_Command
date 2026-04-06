# VoBotiq - Voice Robot Control

An interactive agentic chatbot for controlling Gausium cleaning robots via voice and text. Built with React, Express, and OpenAI.

## Features

- **Conversational AI** - Chat naturally with the bot to control robots. It asks clarifying questions, confirms actions, and reports results.
- **Agentic Tool Use** - The bot autonomously fetches robot status, site info, and task lists using OpenAI function calling.
- **Voice Input** - Click the mic button to speak commands. Audio is transcribed via OpenAI Whisper.
- **Voice Output (TTS)** - Toggle "Voice Replies" to have the bot speak responses aloud via browser Speech Synthesis.
- **Real-time Status** - Sidebar shows live battery, localization, current task, and available cleaning tasks.
- **Multi-turn Conversations** - The bot maintains context across messages for natural back-and-forth dialogue.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Voice Capture | Browser Web Audio API (MediaRecorder) |
| Speech-to-Text | OpenAI Whisper API |
| Chat Agent | OpenAI GPT-4o-mini with function calling |
| Backend | Node.js + Express |
| Robot API | Gausium Cloud API |

## Quick Start

```bash
cd voice-robot-control
npm install
npm run dev
```

This starts both the Express backend (port 3001) and Vite frontend (port 5173) concurrently.

Open http://localhost:5173 in your browser.

## Environment Variables

Create a `.env` file in the `voice-robot-control/` directory:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Gausium
GAUSIUM_CLIENT_ID=your_client_id
GAUSIUM_CLIENT_SECRET=your_client_secret
GAUSIUM_OPEN_ACCESS_KEY=your_access_key_secret

# Server
SERVER_PORT=3001
```

If Gausium credentials are not provided, the app falls back to mock robot data for development.

## Architecture

```
Browser (React)          Express Backend           External APIs
+-----------------+     +------------------+     +----------------+
| Chat UI         |---->| POST /api/chat   |---->| OpenAI GPT-4o  |
| - MessageList   |     | (agentic loop)   |     | (function call)|
| - ChatInput     |     |                  |     +----------------+
| - Sidebar       |     | POST /api/voice  |---->| OpenAI Whisper |
|   - RobotSelect |     | (transcription)  |     +----------------+
|   - StatusPanel  |     |                  |
|   - TaskList     |     | Tool Executor    |---->| Gausium API    |
+-----------------+     +------------------+     +----------------+
```

The chat endpoint runs an **agentic tool-use loop**: GPT-4o-mini decides which tools to call (list_robots, get_robot_status, get_site_info, send_command), the backend executes them against the Gausium API, feeds results back, and repeats until a final text response is produced.

## Project Structure

```
voice-robot-control/
  server/
    index.ts                    # Express entry point
    routes/
      chat.ts                   # POST /api/chat - agentic conversation
      voice.ts                  # POST /api/voice - Whisper transcription
      robot.ts                  # Robot proxy routes + mock fallback
    services/
      chat-tools.ts             # Tool definitions + executor
      chat-system-prompt.ts     # System prompt for the agent
      openai.ts                 # Whisper transcription
      gausium-api.ts            # Gausium API client
      gausium-auth.ts           # OAuth token management
  src/
    App.tsx                     # Sidebar + Chat layout
    components/
      Sidebar.tsx               # Robot selector, status, controls
      chat/
        ChatContainer.tsx       # Message list + input
        MessageBubble.tsx       # User/assistant message bubbles
        ChatInput.tsx           # Text + mic + send
        ToolActivityIndicator.tsx
        TypingIndicator.tsx
    hooks/
      useChat.ts                # Conversation state management
      useTTS.ts                 # Browser speech synthesis
      useAudioRecorder.ts       # MediaRecorder wrapper
      useRobotStatus.ts         # Status polling
    services/
      api.ts                    # Backend API client
```
