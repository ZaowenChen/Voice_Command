export interface Robot {
  serialNumber: string;
  displayName: string;
  modelTypeCode: string;
  online: boolean;
  robotType?: 'gausium' | 'pudu';
}

export interface RobotStatus {
  serialNumber: string;
  battery: number;
  localized: boolean;
  currentMap: string | null;
  currentMapId: string | null;
  currentTask: string | null;
  taskState: 'idle' | 'running' | 'paused' | 'error';
  position: { x: number; y: number; angle: number } | null;
  cleanWater?: number | null;  // 0-100, only present for scrubber-type robots
  dirtyWater?: number | null;  // 0-100, only present for scrubber-type robots
}

export interface WorkMode {
  id: string;
  name: string;
  type?: string;
}

export interface MapInfo {
  id: string;
  name: string;
  tasks: Array<{ name: string; id?: string }>;
  positions: Array<{ name: string; x: number; y: number }>;
  workModes?: WorkMode[];
}

export interface SiteInfo {
  buildings: Array<{
    name: string;
    floors: Array<{
      name: string;
      maps: MapInfo[];
    }>;
  }>;
}

export interface ParsedCommand {
  intent:
    | 'start_task'
    | 'stop_task'
    | 'pause_task'
    | 'resume_task'
    | 'navigate'
    | 'stop_navigate'
    | 'pause_navigate'
    | 'resume_navigate'
    | 'status'
    | 'unknown';
  confidence: number;
  parameters: {
    taskName?: string;
    mapId?: string;
    position?: string;
    cleaningMode?: string;
  };
  confirmationMessage: string;
}

export interface CommandHistoryEntry {
  id: string;
  timestamp: number;
  transcript: string;
  command: ParsedCommand;
  result: 'success' | 'error' | 'pending';
  errorMessage?: string;
}

// ── Chat types ──

export interface ToolCallRecord {
  toolName: string;
  args: Record<string, any>;
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isVoice?: boolean;
  toolCalls?: ToolCallRecord[];
  status?: 'sending' | 'thinking' | 'complete' | 'error';
}
