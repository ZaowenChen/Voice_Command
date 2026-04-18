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
   * because polling doesn't expose localization — delocalization events arrive
   * via the robotErrorNotice webhook only. */
  localized: boolean;
  /** Whether the robot is online (reachable by the cloud). */
  online?: boolean;
  currentMap: string | null;
  currentMapId: string | null;
  currentTask: string | null;
  taskState: 'idle' | 'running' | 'paused' | 'error';
  position: { x: number; y: number; angle: number } | null;
  executableTasks: Array<{ name: string; id: string; mapName: string }>;
  cleanModes: string[];        // Available Gausium cleaning modes (e.g. ["清扫","清洗","吸尘","尘推"])
  cleanWater?: number | null;  // 0-100, only present for scrubber-type robots
  dirtyWater?: number | null;  // 0-100, only present for scrubber-type robots
  /** Display name, carried through so the detail page can render without
   * waiting for `/api/robots` to resolve. */
  displayName?: string;
  /** Model type hint (e.g. "Pudu", "Scrubber S2"). */
  modelTypeCode?: string;
  /** Optional store / shop name (Pudu only). */
  shopName?: string;
  /** Manufacturer hint so the frontend can render manufacturer-specific UI
   * before `/api/robots` resolves. */
  robotType?: 'gausium' | 'pudu';
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
  /** True when the robot is not assigned to a site and site info was built from status fallback */
  notOnSite?: boolean;
  /** Free-form note, populated when the site data came from a fallback */
  note?: string;
}

// Raw Gausium getSiteInfo response — preserves fields needed to build
// the v2 "withSite" S-line task submission body.
export interface RawSiteInfo {
  siteId?: string;
  siteName?: string;
  buildings?: Array<{
    uuid?: string;
    name?: string;
    floorNum?: number;
    floors?: Array<{
      index?: number;
      name?: string;
      maps?: Array<{
        id?: string;
        name?: string;
        areas?: Array<{
          id?: string;
          name?: string;
        }>;
        tasks?: Array<{
          id?: string;
          name?: string;
        }>;
      }>;
    }>;
  }>;
  // Allow additional fields we may discover from the raw API response
  [key: string]: any;
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
