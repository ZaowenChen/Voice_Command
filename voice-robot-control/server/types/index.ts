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
  cleanWater?: number;   // Pudu only: clean water level (0-100)
  dirtyWater?: number;   // Pudu only: dirty water level (0-100)
}

export interface SiteInfo {
  buildings: Array<{
    name: string;
    floors: Array<{
      name: string;
      maps: Array<{
        id: string;
        name: string;
        tasks: Array<{ name: string; id?: string }>;
        positions: Array<{ name: string; x: number; y: number }>;
      }>;
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

export interface GausiumTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface CommandHistoryEntry {
  id: string;
  timestamp: number;
  transcript: string;
  command: ParsedCommand;
  result: 'success' | 'error' | 'pending';
  errorMessage?: string;
}
