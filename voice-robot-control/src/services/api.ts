import type { Robot, RobotStatus, SiteInfo, ParsedCommand } from '../types';

const BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function fetchRobots(): Promise<Robot[]> {
  return fetchJSON<Robot[]>('/robots');
}

export async function fetchRobotStatus(sn: string): Promise<RobotStatus> {
  return fetchJSON<RobotStatus>(`/robots/${sn}/status`);
}

export async function fetchSiteInfo(sn: string): Promise<SiteInfo> {
  return fetchJSON<SiteInfo>(`/robots/${sn}/site`);
}

export async function sendVoiceAudio(audioBlob: Blob): Promise<{ transcript: string }> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const res = await fetch(`${BASE}/voice`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voice API error (${res.status}): ${text}`);
  }

  return res.json();
}

export async function parseTranscript(
  transcript: string,
  context: {
    serialNumber: string;
    currentMap?: string | null;
    currentMapId?: string | null;
    availableTasks?: string[];
    availablePositions?: string[];
  }
): Promise<ParsedCommand> {
  return fetchJSON<ParsedCommand>('/parse', {
    method: 'POST',
    body: JSON.stringify({ transcript, context }),
  });
}

export async function sendRobotCommand(sn: string, commandBody: any): Promise<any> {
  return fetchJSON(`/robots/${sn}/commands`, {
    method: 'POST',
    body: JSON.stringify(commandBody),
  });
}

// ── Chat API ──

export async function sendChatMessage(
  messages: Array<{ role: string; content: string }>,
  selectedRobotSN?: string
): Promise<{ reply: string; toolCalls?: Array<{ toolName: string; args: Record<string, any>; result?: string }> }> {
  return fetchJSON('/chat', {
    method: 'POST',
    body: JSON.stringify({ messages, selectedRobotSN }),
  });
}
