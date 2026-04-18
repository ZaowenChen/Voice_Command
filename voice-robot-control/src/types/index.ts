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
  /** Whether the robot is localized on its map. For Pudu this is always `true`
   * because the polling endpoint doesn't expose localization state — true
   * delocalization events arrive via the robotErrorNotice webhook only. */
  localized: boolean;
  /** Whether the robot is online (reachable by the cloud). */
  online?: boolean;
  currentMap: string | null;
  currentMapId: string | null;
  currentTask: string | null;
  taskState: 'idle' | 'running' | 'paused' | 'error';
  position: { x: number; y: number; angle: number } | null;
  cleanWater?: number | null;  // 0-100, only present for scrubber-type robots
  dirtyWater?: number | null;  // 0-100, only present for scrubber-type robots
  /** Robot display name, echoed from the backend so the detail page can
   * render something even before `/api/robots` resolves. */
  displayName?: string;
  /** Model type hint (e.g. "Pudu", "Scrubber S2"). Same rationale as above. */
  modelTypeCode?: string;
  /** Optional store / shop name (Pudu only). */
  shopName?: string;
  /** Manufacturer hint so UI helpers (e.g. showsWaterLevels) work before
   * `/api/robots` has resolved. */
  robotType?: 'gausium' | 'pudu';
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
  /** Optional explanation when `maps` is empty — e.g. robot delocalized, or
   * no tasks are defined on the robot's current map. Pudu-only today. */
  note?: string;
  /** Whether the robot reports being localized. Pudu derives this from
   * `cleanbot.task === -200`; `true` when absent. */
  localized?: boolean;
  /** Map the robot reports being on (may be stale if delocalized). */
  currentMap?: string;
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
