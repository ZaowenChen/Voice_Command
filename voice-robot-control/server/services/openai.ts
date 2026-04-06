import OpenAI from 'openai';
import fs from 'fs';
import type { ParsedCommand } from '../types/index.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribeAudio(filePath: string): Promise<string> {
  const file = fs.createReadStream(filePath);
  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });
  return response.text;
}

export async function parseIntent(
  transcript: string,
  context: {
    serialNumber: string;
    currentMap?: string | null;
    currentMapId?: string | null;
    availableTasks?: string[];
    availablePositions?: string[];
  }
): Promise<ParsedCommand> {
  const systemPrompt = `You are a robot command parser for Gausium cleaning robots.

Given a voice transcript from an operator, return a JSON object with the command to execute.

Available context:
- Current robot SN: ${context.serialNumber}
- Current map: ${context.currentMap || 'unknown'} (ID: ${context.currentMapId || 'unknown'})
- Available tasks on this map: ${JSON.stringify(context.availableTasks || [])}
- Available navigation points: ${JSON.stringify(context.availablePositions || [])}

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

Match task/position names fuzzy - e.g. "clean area A" should match
"execute_task_a" from the task list. If ambiguous, set intent to "unknown".`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: transcript },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from GPT');

  return JSON.parse(content) as ParsedCommand;
}
