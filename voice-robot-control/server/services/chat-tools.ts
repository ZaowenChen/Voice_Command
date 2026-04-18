import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { hasGausiumCredentials } from './gausium-auth.js';
import { hasPuduCredentials } from './pudu-api.js';
import * as gausiumApi from './gausium-api.js';
import * as puduApi from './pudu-api.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Tool Definitions (OpenAI function-calling format) ──

export const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_robots',
      description:
        'List all available cleaning robots with their serial numbers, display names, model types, and online status.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_robot_status',
      description:
        'Get the current status of a specific robot including battery level, localization state, current map, current task, position, available cleaning tasks (executableTasks), and cleaning modes (cleanModes). For scrubber-type robots, also returns cleanWater and dirtyWater tank levels (0-100%). Prefer this over get_site_info when all you need is available tasks and modes for START_TASK.',
      parameters: {
        type: 'object',
        properties: {
          serial_number: {
            type: 'string',
            description: 'The serial number of the robot (e.g. "GS438-6160-ACQ-R200")',
          },
        },
        required: ['serial_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_site_info',
      description:
        'Get site information for a robot including available buildings, floors, maps, cleaning tasks, work/cleaning modes, and navigation points. Work modes (e.g. sweep, wash, vacuum) are different from tasks — they define HOW the robot cleans, while tasks define WHERE.',
      parameters: {
        type: 'object',
        properties: {
          serial_number: {
            type: 'string',
            description: 'The serial number of the robot',
          },
        },
        required: ['serial_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_command',
      description:
        'Send a command to a robot. IMPORTANT: Always confirm with the user before calling this tool. PUDU_* command types are for Pudu robots only; the generic START_TASK/STOP_TASK/etc. work for both Gausium and Pudu robots.',
      parameters: {
        type: 'object',
        properties: {
          serial_number: {
            type: 'string',
            description: 'The serial number of the robot',
          },
          manufacturer: {
            type: 'string',
            enum: ['gausium', 'pudu'],
            description:
              'Optional manufacturer hint. Normally inferred from the robot — only set this if you want to force a specific path (e.g. when testing).',
          },
          command_type: {
            type: 'string',
            enum: [
              'START_TASK',
              'STOP_TASK',
              'PAUSE_TASK',
              'RESUME_TASK',
              'CROSS_NAVIGATE',
              'PAUSE_NAVIGATE',
              'RESUME_NAVIGATE',
              'STOP_NAVIGATE',
              'PUDU_CLEAN',
              'PUDU_CHARGE',
              'PUDU_RESUPPLY',
              'PUDU_RETURN_HOME',
              'PUDU_GO_TO_POINT',
              'PUDU_SWITCH_MAP',
            ],
            description:
              'The type of command to send. Use PUDU_CLEAN for explicit Pudu clean-task control (with pudu_status), PUDU_CHARGE to send a Pudu robot to charge, PUDU_RESUPPLY for water/detergent resupply, PUDU_RETURN_HOME for one-key return, PUDU_GO_TO_POINT to send the robot to a configured return point (optional pudu_point_id selects which one; omit to let the robot choose) — this is NOT arbitrary-named-point navigation, and PUDU_SWITCH_MAP with pudu_map_name.',
          },
          task_name: {
            type: 'string',
            description: 'The task name (required for START_TASK)',
          },
          map_name: {
            type: 'string',
            description:
              'The map name (not UUID) for the command, e.g. "9-2" or "Floor-1". Get this from robot status currentMap or site info map names.',
          },
          position_name: {
            type: 'string',
            description: 'Target navigation point name (for navigation commands, e.g. "Lobby")',
          },
          cleaning_mode: {
            type: 'string',
            description: 'Cleaning mode (optional for START_TASK)',
          },
          pudu_task_id: {
            type: 'string',
            description:
              'Pudu task id (string) from get_pudu_tasks. Required for PUDU_CLEAN with status=1 (start).',
          },
          pudu_task_version: {
            type: 'number',
            description:
              'Pudu task version number (integer) from get_pudu_tasks. Required for PUDU_CLEAN with status=1 (start).',
          },
          pudu_status: {
            type: 'number',
            enum: [1, 3, 4],
            description:
              'Pudu clean-task status: 1=start, 3=pause, 4=cancel. Used by PUDU_CLEAN.',
          },
          pudu_point_id: {
            type: 'string',
            description:
              'Optional return-point id for PUDU_GO_TO_POINT (type 6 = "go to return point"). Omit to let the robot pick the default return point. NOTE: type 6 is restricted to points configured as return points on the robot — it is not a general go-to-named-point command.',
          },
          pudu_map_name: {
            type: 'string',
            description:
              'Target map name for PUDU_SWITCH_MAP (type 9). The robot will load this map.',
          },
          pudu_cleanagent_scale: {
            type: 'number',
            description:
              'Optional detergent/water scale (0-100) for PUDU_CLEAN or PUDU_RESUPPLY. Omit to use the task default.',
          },
        },
        required: ['serial_number', 'command_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_command_status',
      description:
        'Check the status of a previously sent command. Use this after send_command to verify the robot accepted it. Returns the command state: WAITING, ACCEPTED, REJECTED, COMPLETED, or FAILED. Gausium-only — Pudu commands return immediately.',
      parameters: {
        type: 'object',
        properties: {
          serial_number: {
            type: 'string',
            description: 'The serial number of the robot',
          },
          command_id: {
            type: 'string',
            description: 'The command UUID returned from send_command',
          },
        },
        required: ['serial_number', 'command_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pudu_tasks',
      description:
        'List available Pudu cleaning tasks for a specific robot with their task_id, version, name, mode, mapName, and floor. Use this to pick a task_id + version before calling send_command with PUDU_CLEAN.',
      parameters: {
        type: 'object',
        properties: {
          serial_number: {
            type: 'string',
            description: 'The serial number of the Pudu robot',
          },
          map_name: {
            type: 'string',
            description:
              'Optional filter: only return tasks defined on this map name. If omitted, returns tasks from the robot\'s current map (falling back to all tasks when none are defined on the current map).',
          },
        },
        required: ['serial_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pudu_cleaning_summary',
      description:
        'Fetch aggregated cleaning totals (area, duration, water used, etc.) for a time window. Useful for "how much did we clean this week" questions. Pudu-only. NOTE: Pudu analytics are scoped to stores (shop_id), not individual robots — there is no sn filter. Data lags up to ~1 hour behind the robot.',
      parameters: {
        type: 'object',
        properties: {
          start_time: {
            type: 'number',
            description: 'Inclusive start timestamp as unix seconds.',
          },
          end_time: {
            type: 'number',
            description: 'Inclusive end timestamp as unix seconds.',
          },
          shop_id: {
            type: 'number',
            description: 'Optional store id filter.',
          },
          clean_mode: {
            type: 'number',
            description: 'Mode filter: 0=all, 1=mopping, 2=sweeping. Defaults to 0.',
          },
          sub_mode: {
            type: 'number',
            description: 'Optional sub-mode filter.',
          },
          timezone_offset: {
            type: 'number',
            description: 'Timezone offset in hours, -12 to +14. Defaults to 0 (UTC).',
          },
        },
        required: ['start_time', 'end_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pudu_cleaning_reports',
      description:
        'Fetch a paginated list of individual Pudu cleaning session reports (one entry per cleaning run). Use for "list recent cleaning runs" or drilling into a specific session. Pudu-only. NOTE: Scoped by store (shop_id) — no per-robot filter. Data lags up to ~10 minutes and lookback is capped at 180 days.',
      parameters: {
        type: 'object',
        properties: {
          start_time: {
            type: 'number',
            description: 'Inclusive start timestamp as unix seconds.',
          },
          end_time: {
            type: 'number',
            description: 'Inclusive end timestamp as unix seconds.',
          },
          shop_id: {
            type: 'number',
            description: 'Optional store id filter.',
          },
          offset: {
            type: 'number',
            description: 'Pagination offset. Defaults to 0.',
          },
          limit: {
            type: 'number',
            description: 'Items per page, 1 to 20. Defaults to 10.',
          },
          timezone_offset: {
            type: 'number',
            description: 'Timezone offset in hours. Defaults to 0.',
          },
        },
        required: ['start_time', 'end_time'],
      },
    },
  },
];

// ── Robot type resolution ──

// Cache of robot type by SN (populated from list_robots calls)
const robotTypeCache = new Map<string, 'gausium' | 'pudu'>();

// Cache of Gausium modelTypeCode by SN (populated from list_robots).
// Used to distinguish S-line (e.g. "Scrubber S1", "Scrubber S2") from M-line
// (e.g. "50H", "75") — they need different task-submission endpoints.
const gausiumModelCache = new Map<string, string>();

function isSLineModel(modelTypeCode: string | undefined): boolean {
  if (!modelTypeCode) return false;
  // S-line scrubbers use the v2 site-task endpoint. Pattern: "S1", "S2", "Scrubber S*", "Phantas"
  return /\bS\d+\b|scrubber\s*s\d+|phantas/i.test(modelTypeCode);
}

function getMockRobots() {
  const filePath = path.join(__dirname, '../../test-data/robots.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getRobotType(sn: string): 'gausium' | 'pudu' {
  // Check cache first
  const cached = robotTypeCache.get(sn);
  if (cached) return cached;

  // Check env-configured SNs
  const gausiumSns = process.env.GAUSIUM_ROBOT_SNS?.split(',').map((s) => s.trim()) || [];
  if (gausiumSns.includes(sn)) {
    robotTypeCache.set(sn, 'gausium');
    return 'gausium';
  }
  const puduSns = process.env.PUDU_ROBOT_SNS?.split(',').map((s) => s.trim()) || [];
  if (puduSns.includes(sn)) {
    robotTypeCache.set(sn, 'pudu');
    return 'pudu';
  }

  // Check mock data
  const mockRobots = getMockRobots();
  const mockMatch = mockRobots.find((r: any) => r.serialNumber === sn);
  if (mockMatch?.robotType) {
    robotTypeCache.set(sn, mockMatch.robotType);
    return mockMatch.robotType;
  }

  // Default: if Pudu credentials are set and Gausium are not, assume Pudu
  // Otherwise default to Gausium for backwards compatibility
  if (hasPuduCredentials() && !hasGausiumCredentials()) return 'pudu';
  return 'gausium';
}

// ── Mock data fallbacks ──

function isMockScrubber(sn: string): boolean {
  const mockRobots = getMockRobots();
  const match = mockRobots.find((r: any) => r.serialNumber === sn);
  if (!match) return false;
  const model = (match.modelTypeCode || '').toLowerCase();
  return model.includes('scrub') || model.includes('wash') || model.includes('mop');
}

function getMockStatus(sn: string) {
  const isPudu = getRobotType(sn) === 'pudu';
  const hasTanks = isMockScrubber(sn) || isPudu;
  const mapName = isPudu ? 'Lobby-Map' : 'Floor-2';
  return {
    serialNumber: sn,
    battery: 75,
    localized: true,
    currentMap: mapName,
    currentMapId: isPudu ? 'pudu-map-001' : 'map-001',
    currentTask: null,
    taskState: 'idle',
    position: isPudu ? null : { x: 10.5, y: 20.3, angle: 90 },
    executableTasks: isPudu
      ? [
          { name: 'Full Mop Lobby', id: 'pudu-task-001', mapName },
          { name: 'Quick Sweep Lobby', id: 'pudu-task-002', mapName },
        ]
      : [
          { name: 'Full Clean F1', id: 'task-001', mapName },
          { name: 'Quick Sweep F1', id: 'task-002', mapName },
        ],
    cleanModes: isPudu ? [] : ['__middle_cleaning', '__heavy_cleaning'],
    ...(hasTanks ? { cleanWater: 82, dirtyWater: 23 } : {}),
  };
}

function getMockSiteInfo(sn: string) {
  const isPudu = getRobotType(sn) === 'pudu';
  if (isPudu) {
    return {
      buildings: [
        {
          name: 'Main Building',
          floors: [
            {
              name: 'Floor 1',
              maps: [
                {
                  id: 'pudu-map-001',
                  name: 'Lobby-Map',
                  tasks: [
                    { name: 'Full Mop Lobby', id: 'pudu-task-001' },
                    { name: 'Quick Sweep Lobby', id: 'pudu-task-002' },
                  ],
                  positions: [],
                },
              ],
            },
          ],
        },
      ],
    };
  }
  return {
    buildings: [
      {
        name: 'Main Building',
        floors: [
          {
            name: 'Floor 1',
            maps: [
              {
                id: 'map-001',
                name: 'Floor-1',
                tasks: [
                  { name: 'Full Clean F1', id: 'task-001' },
                  { name: 'Quick Sweep F1', id: 'task-002' },
                ],
                positions: [
                  { name: 'Lobby', x: 5.0, y: 10.0 },
                  { name: 'Charger', x: 1.0, y: 1.0 },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

// ── Build Gausium command body ──

function buildGausiumCommandBody(
  sn: string,
  commandType: string,
  args: {
    task_name?: string;
    map_name?: string;
    position_name?: string;
    cleaning_mode?: string;
  }
): any {
  switch (commandType) {
    case 'START_TASK':
      return {
        serialNumber: sn,
        remoteTaskCommandType: 'START_TASK',
        commandParameter: {
          startTaskParameter: {
            cleaningMode: args.cleaning_mode,
            task: {
              map: args.map_name,
              name: args.task_name || '',
              loop: false,
              loopCount: 1,
            },
          },
        },
      };
    case 'PAUSE_TASK':
      return { serialNumber: sn, remoteTaskCommandType: 'PAUSE_TASK' };
    case 'RESUME_TASK':
      return { serialNumber: sn, remoteTaskCommandType: 'RESUME_TASK' };
    case 'STOP_TASK':
      return { serialNumber: sn, remoteTaskCommandType: 'STOP_TASK' };
    case 'CROSS_NAVIGATE':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'CROSS_NAVIGATE',
        commandParameter: {
          startNavigationParameter: {
            map: args.map_name,
            position: args.position_name,
          },
        },
      };
    case 'PAUSE_NAVIGATE':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'PAUSE_NAVIGATE',
        commandParameter: { startNavigationParameter: { map: args.map_name } },
      };
    case 'RESUME_NAVIGATE':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'RESUME_NAVIGATE',
        commandParameter: { startNavigationParameter: { map: args.map_name } },
      };
    case 'STOP_NAVIGATE':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'STOP_NAVIGATE',
        commandParameter: { startNavigationParameter: { map: args.map_name } },
      };
    default:
      return { serialNumber: sn };
  }
}

// ── Gausium helpers ──

/**
 * After submitting a task command, wait briefly and re-read status to verify
 * the robot actually started it. The v1alpha1 commands endpoint in particular
 * silently ignores commands for S-line robots and still returns 200.
 */
async function verifyTaskStarted(
  sn: string,
  expectedTaskName: string | undefined
): Promise<{ verified: boolean; currentTask: string | null; taskState: string }> {
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const status = await gausiumApi.getRobotStatus(sn);
    const verified =
      (expectedTaskName != null && status.currentTask === expectedTaskName) ||
      status.taskState === 'running';
    return {
      verified,
      currentTask: status.currentTask,
      taskState: status.taskState,
    };
  } catch {
    return { verified: false, currentTask: null, taskState: 'unknown' };
  }
}

// ── Gausium S-line task body builders ──

/**
 * Build the body for POST /openapi/v2/robot/tasks/temp/withSite.
 * Requires raw site info with siteId/siteName/buildings/floors/maps/areas.
 * Returns null if the raw site info doesn't have enough structure to build a valid body.
 */
function buildSiteTaskBody(
  sn: string,
  rawSite: any,
  args: {
    task_name?: string;
    map_name?: string;
    cleaning_mode?: string;
  }
): any | null {
  if (!rawSite || !rawSite.buildings) return null;

  // Find the target map/floor. Prefer args.map_name; otherwise use the first map found.
  let targetFloor: any = null;
  let targetMap: any = null;
  for (const b of rawSite.buildings || []) {
    for (const f of b.floors || []) {
      for (const m of f.maps || []) {
        if (!targetMap) {
          targetFloor = f;
          targetMap = m;
        }
        if (args.map_name && m.name === args.map_name) {
          targetFloor = f;
          targetMap = m;
          break;
        }
      }
    }
  }
  if (!targetMap) return null;

  // Resolve area: prefer matching args.task_name against areas/tasks on the map.
  const areas = targetMap.areas || targetMap.tasks || [];
  let area =
    areas.find((a: any) => a.name && args.task_name && a.name.toLowerCase() === args.task_name.toLowerCase()) ||
    areas[0];

  if (!area) return null;

  return {
    serialNumber: sn,
    cleaningMode: args.cleaning_mode || '清扫',
    loopCount: 1,
    siteId: rawSite.siteId || rawSite.id,
    siteName: rawSite.siteName || rawSite.name,
    taskName: args.task_name || area.name || targetMap.name,
    floors: [
      {
        index: targetFloor?.index ?? 1,
        name: targetFloor?.name ?? '',
        mapId: targetMap.id,
        area: { id: area.id, name: area.name },
      },
    ],
    tasks: [
      {
        mapId: targetMap.id,
        subTasks: [{ mapId: targetMap.id, areaId: area.id }],
      },
    ],
  };
}

/**
 * Build the body for POST /openapi/v2/robot/tasks/temp/withoutSite.
 * This is the correct endpoint for S-line robots that are NOT on a site.
 * Body shape is documented by Gausium as:
 *   {
 *     productId, tempTaskCommand: {
 *       cleaningMode, loop, loopCount, taskName, mapName,
 *       startParam: [{ mapId, areaId }]
 *     }
 *   }
 */
function buildNoSiteTaskBody(
  sn: string,
  args: {
    task_name?: string;
    cleaning_mode?: string;
    map_id?: string;
    map_name?: string;
    area_id?: string;
  }
): any {
  const startParam: any = {};
  if (args.map_id) startParam.mapId = args.map_id;
  // areaId is required by the endpoint; default to "1" (first area) per the docs example
  startParam.areaId = args.area_id || '1';

  return {
    productId: sn,
    tempTaskCommand: {
      cleaningMode: args.cleaning_mode || '清扫',
      loop: false,
      loopCount: 1,
      taskName: args.task_name || args.map_name || 'temp-task',
      mapName: args.map_name || args.task_name || '',
      startParam: [startParam],
    },
  };
}

/**
 * Build the body for POST /v2alpha1/robotCommand/tempTask:send.
 * Simpler fallback that needs only mapId (and optionally areaId).
 */
function buildTempTaskBody(
  sn: string,
  args: {
    task_name?: string;
    map_id?: string;
    map_name?: string;
    cleaning_mode?: string;
    area_id?: string;
  }
): any {
  const startParam: any = {};
  if (args.map_id) startParam.mapId = args.map_id;
  if (args.area_id) startParam.areaId = args.area_id;

  return {
    productId: sn,
    tempTaskCommand: {
      taskName: args.task_name || args.map_name || 'temp-task',
      cleaningMode: args.cleaning_mode || '清扫',
      loop: 'false',
      loopCount: '1',
      mapName: args.map_name || '',
      startParam,
    },
  };
}

// ── Pudu command helpers ──

// Pudu task cache: sn → PuduTask[] (populated during get_site_info)
const puduTaskCache = new Map<string, puduApi.PuduTask[]>();

/**
 * Build a SiteInfo for a Pudu robot by grouping tasks by their map name.
 * This makes two tasks that share a name (e.g. two "Carpet Run" entries
 * on different maps) distinguishable — each becomes a task under its own
 * map entry, so it can be disambiguated by `map_name` when starting the task.
 */
function buildPuduSiteInfo(
  ps: puduApi.PuduRobotStatus,
  tasks: puduApi.PuduTask[]
) {
  // Group tasks by mapName. Tasks with no mapName go under the robot's
  // current map as a fallback bucket.
  const currentMap = ps.mapName || 'Current Map';
  const byMap = new Map<string, puduApi.PuduTask[]>();
  for (const t of tasks) {
    const key = t.mapName || currentMap;
    if (!byMap.has(key)) byMap.set(key, []);
    byMap.get(key)!.push(t);
  }

  // Sort maps so the robot's current map (if present) comes first — gives
  // the agent an obvious default when the user doesn't specify a map.
  const mapNames = Array.from(byMap.keys()).sort((a, b) => {
    if (a === currentMap) return -1;
    if (b === currentMap) return 1;
    return a.localeCompare(b);
  });

  return {
    buildings: [
      {
        name: ps.shopName || 'Site',
        floors: [
          {
            name: `Robot is on: ${currentMap}`,
            maps: mapNames.map((mapName) => ({
              // Prefix with "pudu-" so the agent can pass this back as map_name
              // (the disambiguation code also strips the prefix if present).
              id: `pudu-${mapName}`,
              name: mapName,
              tasks: (byMap.get(mapName) || []).map((t) => ({
                name: t.name,
                id: t.task_id,
              })),
              positions: [],
            })),
          },
        ],
      },
    ],
    notOnSite: tasks.length > 0 && !tasks.some((t) => t.mapName === currentMap),
    note:
      tasks.length > 0 && !tasks.some((t) => t.mapName === currentMap)
        ? `The robot is localized on "${currentMap}", but no tasks are defined on that map. Showing all available tasks grouped by their map — the robot will need to be re-localized on the target task's map before START_TASK can succeed.`
        : undefined,
  };
}

/**
 * Resolve a cached Pudu task by name, with optional map-name disambiguation.
 * Returns either a single matched PuduTask or an error message string.
 */
function resolvePuduTaskByName(
  sn: string,
  taskName: string | undefined,
  mapNameArg: string | undefined
): puduApi.PuduTask | { error: string } {
  const tasks = puduTaskCache.get(sn) || [];
  const wantedName = (taskName || '').toLowerCase();
  const candidates = tasks.filter((t) => t.name.toLowerCase() === wantedName);
  if (candidates.length === 0) {
    return {
      error: `Task "${taskName}" not found. Use get_pudu_tasks or get_site_info first.`,
    };
  }
  if (candidates.length === 1) return candidates[0];

  const rawMap = typeof mapNameArg === 'string' ? mapNameArg : null;
  const wantedMap = rawMap?.startsWith('pudu-') ? rawMap.slice('pudu-'.length) : rawMap;
  if (!wantedMap) {
    return {
      error: `Task "${taskName}" is defined on multiple maps (${candidates
        .map((c) => c.mapName || 'unknown')
        .join(', ')}). Please specify which map by passing map_name.`,
    };
  }
  const narrowed = candidates.find((t) => t.mapName === wantedMap);
  if (!narrowed) {
    return {
      error: `Task "${taskName}" exists on multiple maps but not on "${wantedMap}". Available on: ${candidates
        .map((c) => c.mapName || 'unknown')
        .join(', ')}`,
    };
  }
  return narrowed;
}

async function executePuduCommand(
  sn: string,
  commandType: string,
  args: Record<string, any>
): Promise<string> {
  switch (commandType) {
    case 'START_TASK': {
      const resolved = resolvePuduTaskByName(sn, args.task_name, args.map_name);
      if ('error' in resolved) return JSON.stringify(resolved);

      const clean: Record<string, any> = {
        status: 1,
        task_id: String(resolved.task_id),
        version: resolved.version,
      };
      if (typeof args.pudu_cleanagent_scale === 'number') {
        clean.cleanagent_scale = args.pudu_cleanagent_scale;
      }
      const taskId = await puduApi.sendPuduCommand(sn, 3, clean);
      return JSON.stringify({
        success: true,
        data: { task_id: taskId, map: resolved.mapName },
      });
    }
    case 'PAUSE_TASK': {
      const taskId = await puduApi.sendPuduCommand(sn, 3, { status: 3 });
      return JSON.stringify({ success: true, data: { task_id: taskId } });
    }
    case 'STOP_TASK': {
      const taskId = await puduApi.sendPuduCommand(sn, 3, { status: 4 });
      return JSON.stringify({ success: true, data: { task_id: taskId } });
    }
    case 'RESUME_TASK': {
      // Pudu has no distinct resume; re-issue status=1 (start). The plan
      // explicitly notes Pudu has no RESUME, but we keep the mapping so
      // the agent's generic RESUME_TASK still does something reasonable.
      const taskId = await puduApi.sendPuduCommand(sn, 3, { status: 1 });
      return JSON.stringify({
        success: true,
        data: { task_id: taskId, note: 'Pudu has no native resume; re-issued start.' },
      });
    }
    case 'CROSS_NAVIGATE':
    case 'STOP_NAVIGATE': {
      // Legacy: map navigation to "one-key return" (type 5)
      const taskId = await puduApi.sendPuduCommand(sn, 5);
      return JSON.stringify({
        success: true,
        data: { task_id: taskId, note: 'Sent return-to-base command' },
      });
    }
    case 'PAUSE_NAVIGATE': {
      const taskId = await puduApi.sendPuduCommand(sn, 3, { status: 3 });
      return JSON.stringify({ success: true, data: { task_id: taskId } });
    }

    // ── Pudu-specific explicit command types ──

    case 'PUDU_CLEAN': {
      // Explicit Pudu clean-task control. Caller passes pudu_status (1/3/4).
      // For status=1 (start), also requires task_id + version either as
      // pudu_task_id/pudu_task_version or via task_name lookup.
      const status = args.pudu_status;
      if (status !== 1 && status !== 3 && status !== 4) {
        return JSON.stringify({
          error: 'PUDU_CLEAN requires pudu_status (1=start, 3=pause, 4=cancel).',
        });
      }

      const clean: Record<string, any> = { status };

      if (status === 1) {
        let taskId: string | undefined = args.pudu_task_id
          ? String(args.pudu_task_id)
          : undefined;
        let version: number | undefined =
          typeof args.pudu_task_version === 'number' ? args.pudu_task_version : undefined;

        if (!taskId || typeof version !== 'number') {
          const resolved = resolvePuduTaskByName(sn, args.task_name, args.map_name);
          if ('error' in resolved) return JSON.stringify(resolved);
          taskId = String(resolved.task_id);
          version = resolved.version;
        }

        clean.task_id = taskId;
        clean.version = version;
      }

      if (typeof args.pudu_cleanagent_scale === 'number') {
        clean.cleanagent_scale = args.pudu_cleanagent_scale;
      }

      const result = await puduApi.sendPuduCommand(sn, 3, clean);
      return JSON.stringify({ success: true, data: { task_id: result } });
    }
    case 'PUDU_CHARGE': {
      // type 1 = go to charging station
      const result = await puduApi.sendPuduCommand(sn, 1);
      return JSON.stringify({ success: true, data: { task_id: result } });
    }
    case 'PUDU_RESUPPLY': {
      // type 4 = resupply (water/detergent)
      const clean: Record<string, any> | undefined =
        typeof args.pudu_cleanagent_scale === 'number'
          ? { cleanagent_scale: args.pudu_cleanagent_scale }
          : undefined;
      const result = await puduApi.sendPuduCommand(sn, 4, clean);
      return JSON.stringify({ success: true, data: { task_id: result } });
    }
    case 'PUDU_RETURN_HOME': {
      // type 5 = one-key return to base
      const result = await puduApi.sendPuduCommand(sn, 5);
      return JSON.stringify({ success: true, data: { task_id: result } });
    }
    case 'PUDU_GO_TO_POINT': {
      // type 6 = "go to return point". `point_id` narrows which configured
      // return point to use; omitting it lets the robot pick. This is NOT a
      // general named-point navigation command.
      const clean: Record<string, any> | undefined =
        args.pudu_point_id || args.position_name
          ? { point_id: String(args.pudu_point_id || args.position_name) }
          : undefined;
      const result = await puduApi.sendPuduCommand(sn, 6, clean);
      return JSON.stringify({ success: true, data: { task_id: result } });
    }
    case 'PUDU_SWITCH_MAP': {
      // type 9 = switch map
      const targetMap = args.pudu_map_name || args.map_name;
      if (!targetMap) {
        return JSON.stringify({
          error: 'PUDU_SWITCH_MAP requires pudu_map_name (or map_name).',
        });
      }
      const result = await puduApi.sendPuduCommand(sn, 9, { map_name: String(targetMap) });
      return JSON.stringify({ success: true, data: { task_id: result } });
    }

    default:
      return JSON.stringify({ error: `Unsupported command type: ${commandType}` });
  }
}

// ── Tool Executor ──

export async function executeTool(
  name: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (name) {
      case 'list_robots': {
        let allRobots: any[] = [];

        // Fetch Gausium robots
        if (hasGausiumCredentials()) {
          const gausiumSns = process.env.GAUSIUM_ROBOT_SNS?.split(',').map((s) => s.trim()).filter(Boolean) || [];

          // Always try list API first to get proper display names and model types
          let listedRobots: any[] = [];
          try {
            const gRobots = await gausiumApi.listRobots();
            listedRobots = gRobots.map((r) => ({ ...r, robotType: 'gausium' }));
          } catch {
            // Fall through
          }

          if (gausiumSns.length > 0) {
            for (const gsn of gausiumSns) {
              const listed = listedRobots.find((r: any) => r.serialNumber === gsn);
              if (listed) {
                allRobots.push(listed);
              } else {
                try {
                  const status = await gausiumApi.getRobotStatus(gsn);
                  allRobots.push({
                    serialNumber: gsn,
                    displayName: gsn,
                    modelTypeCode: 'Gausium',
                    online: status.localized ?? true,
                    robotType: 'gausium',
                  });
                } catch {
                  allRobots.push({
                    serialNumber: gsn,
                    displayName: gsn,
                    modelTypeCode: 'Gausium',
                    online: false,
                    robotType: 'gausium',
                  });
                }
              }
            }
          } else {
            allRobots.push(...listedRobots);
          }
        }

        // Fetch Pudu robots from env config
        if (hasPuduCredentials()) {
          const puduSns = process.env.PUDU_ROBOT_SNS?.split(',').map((s) => s.trim()).filter(Boolean) || [];
          for (const psn of puduSns) {
            // robot/detail (cleanbot-service) doesn't return the model —
            // product_code lives on V2 status (§3.1). Pull both in parallel
            // and fall back gracefully so one failing doesn't hide the robot.
            const [statusRes, v2Res] = await Promise.allSettled([
              puduApi.getPuduRobotStatus(psn),
              puduApi.getPuduRobotStatusV2(psn),
            ]);
            const status =
              statusRes.status === 'fulfilled' ? statusRes.value : null;
            const v2 =
              v2Res.status === 'fulfilled' ? v2Res.value : null;
            const productCode =
              typeof v2?.product_code === 'string' && v2.product_code
                ? v2.product_code
                : null;
            allRobots.push({
              serialNumber: psn,
              displayName: status?.nickname || psn,
              modelTypeCode: productCode ? `Pudu ${productCode}` : 'Pudu',
              online:
                status?.online ??
                (v2?.run_state ? v2.run_state !== 'OFFLINE' : false),
              robotType: 'pudu',
            });
          }
        }

        // Fall back to mock data if no real robots fetched
        if (allRobots.length === 0) {
          allRobots = getMockRobots();
        }

        // Update robot type + Gausium model caches
        for (const r of allRobots) {
          if (r.robotType) robotTypeCache.set(r.serialNumber, r.robotType);
          if (r.robotType === 'gausium' && r.modelTypeCode) {
            gausiumModelCache.set(r.serialNumber, r.modelTypeCode);
          }
        }

        return JSON.stringify(allRobots);
      }

      case 'get_robot_status': {
        const sn = args.serial_number;
        const type = getRobotType(sn);

        if (type === 'pudu') {
          // Credentials configured → return real data or real error (never mock)
          if (hasPuduCredentials()) {
            try {
              const ps = await puduApi.getPuduRobotStatus(sn);
              return JSON.stringify({
                serialNumber: sn,
                battery: ps.battery,
                // Localization comes from `cleanbot.task === -200` (§1.5), not
                // from `online`. A delocalized robot is still online but can't
                // accept cleaning commands until re-localized, and its
                // reported currentMap can be stale — flagging this explicitly
                // lets the agent tell the user why tasks might not run.
                localized: ps.online && ps.localized,
                online: ps.online,
                robotActivityCode: ps.robotActivityCode,
                currentMap: ps.mapName,
                currentMapId: null,
                currentTask: ps.currentTask,
                taskState: ps.taskState,
                position: null,
                cleanWater: ps.cleanWater,
                dirtyWater: ps.dirtyWater,
              });
            } catch (err: any) {
              console.warn(`[chat-tools] get_robot_status Pudu failed for ${sn}: ${err?.message || err}`);
              return JSON.stringify({
                error: err?.message || String(err),
                note: `Failed to fetch status for Pudu robot ${sn}.`,
              });
            }
          }
          // No credentials → dev mode, use mock data
          return JSON.stringify(getMockStatus(sn));
        }

        // Gausium
        if (hasGausiumCredentials()) {
          try {
            const status = await gausiumApi.getRobotStatus(sn);
            return JSON.stringify(status);
          } catch (err: any) {
            console.warn(`[chat-tools] get_robot_status Gausium failed for ${sn}: ${err?.message || err}`);
            return JSON.stringify({
              error: err?.message || String(err),
              note: `Failed to fetch status for Gausium robot ${sn}.`,
            });
          }
        }
        // No credentials → dev mode
        return JSON.stringify(getMockStatus(sn));
      }

      case 'get_site_info': {
        const sn = args.serial_number;
        const type = getRobotType(sn);

        if (type === 'pudu') {
          if (hasPuduCredentials()) {
            try {
              const ps = await puduApi.getPuduRobotStatus(sn);
              const tasks = await puduApi.getPuduTaskList(sn, {
                mapName: ps.mapName,
                mapLv: ps.mapLv,
              });
              puduTaskCache.set(sn, tasks);
              return JSON.stringify(buildPuduSiteInfo(ps, tasks));
            } catch (err: any) {
              console.warn(`[chat-tools] get_site_info Pudu failed for ${sn}: ${err?.message || err}`);
              return JSON.stringify({
                error: err?.message || String(err),
                note: `Failed to fetch site info for Pudu robot ${sn}.`,
              });
            }
          }
          return JSON.stringify(getMockSiteInfo(sn));
        }

        // Gausium
        if (hasGausiumCredentials()) {
          try {
            const site = await gausiumApi.getSiteInfo(sn);
            return JSON.stringify(site);
          } catch (err: any) {
            console.warn(`[chat-tools] get_site_info Gausium failed for ${sn}: ${err?.message || err}`);
            return JSON.stringify({
              error: err?.message || String(err),
              note: 'Failed to fetch site info from Gausium API. The robot may not be assigned to a site.',
            });
          }
        }
        return JSON.stringify(getMockSiteInfo(sn));
      }

      case 'send_command': {
        const sn = args.serial_number;
        const commandType = args.command_type;

        // PUDU_* command types always route through the Pudu executor, and
        // an explicit `manufacturer: 'pudu'` hint also forces it. Otherwise
        // fall back to the robot-type cache/env-based resolution.
        const isPuduCommandType = typeof commandType === 'string' && commandType.startsWith('PUDU_');
        const forcedPudu = args.manufacturer === 'pudu' || isPuduCommandType;
        const forcedGausium = args.manufacturer === 'gausium';
        const type: 'gausium' | 'pudu' = forcedPudu
          ? 'pudu'
          : forcedGausium
            ? 'gausium'
            : getRobotType(sn);

        if (type === 'pudu') {
          if (hasPuduCredentials()) {
            return await executePuduCommand(sn, commandType, args);
          }
          console.log(`[mock-pudu-command] ${sn}: ${commandType}`, JSON.stringify(args));
          return JSON.stringify({ success: true, data: { message: 'Mock Pudu command accepted' } });
        }

        // Gausium doesn't support PUDU_* command types; surface a clear error
        // rather than trying to send it through the Gausium endpoint.
        if (isPuduCommandType) {
          return JSON.stringify({
            error: `Command type ${commandType} is only supported for Pudu robots.`,
          });
        }

        // Gausium path — S-line START_TASK uses v2 endpoints, others use v1alpha1 commands
        if (commandType === 'START_TASK' && hasGausiumCredentials()) {
          // Ensure we know this robot's model type. The agent doesn't always
          // call list_robots before send_command, so the cache may be empty —
          // in which case S-line detection silently fails and START_TASK
          // gets routed through the wrong endpoint. Populate the cache
          // lazily before deciding the path.
          let modelTypeCode = gausiumModelCache.get(sn);
          if (!modelTypeCode) {
            try {
              const listed = await gausiumApi.listRobots();
              for (const r of listed) {
                if (r.modelTypeCode) gausiumModelCache.set(r.serialNumber, r.modelTypeCode);
              }
              modelTypeCode = gausiumModelCache.get(sn);
            } catch {
              // List API unavailable — fall through with whatever cache we have.
            }
          }
          let isSLine = isSLineModel(modelTypeCode);

          // Fetch raw status up front — gives us map info, cleanModes,
          // executingTask.id, and lets us decide which endpoint to use.
          let fullStatus: any = null;
          try {
            fullStatus = await gausiumApi.getRobotFullStatus(sn);
          } catch {}

          // Fallback S-line detection: the v2 S-line status endpoint returns
          // `supportSite` and named `navigationPoints` only for S-line robots.
          // A successful response with either field is a reliable indicator.
          if (!isSLine) {
            try {
              const sLineStatus = await gausiumApi.getSLineStatusRaw(sn);
              if (
                sLineStatus &&
                (sLineStatus.supportSite !== undefined ||
                  sLineStatus.navigationPoints?.naviPoints)
              ) {
                isSLine = true;
              }
            } catch {}
          }

          // Try to fetch raw site info (robot is on a site => withSite endpoint)
          const rawSite = await gausiumApi.getRawSiteInfo(sn);
          const hasSiteStructure = !!(rawSite && rawSite.buildings && rawSite.buildings.length > 0);

          if (isSLine || hasSiteStructure) {
            // 1. If robot is on a site → withSite endpoint
            if (hasSiteStructure) {
              const body = buildSiteTaskBody(sn, rawSite, {
                task_name: args.task_name,
                map_name: args.map_name,
                cleaning_mode: args.cleaning_mode,
              });
              if (body) {
                try {
                  const result = await gausiumApi.sendSiteTask(body);
                  const verification = await verifyTaskStarted(sn, args.task_name);
                  return JSON.stringify({
                    success: true,
                    data: result,
                    endpoint: 'withSite',
                    ...verification,
                  });
                } catch (err: any) {
                  console.log('[gausium] sendSiteTask failed, falling back:', err?.message);
                }
              }
            }

            // 2. Robot not on a site → withoutSite endpoint (primary S-line path)
            // Resolve internal mapId (UUID, used in startParam.mapId) from status.
            const mapId = fullStatus?.localizationInfo?.map?.id;
            // Always prefer the robot's CURRENTLY localized map over the
            // task_name — task_name is a human label, not a map name. Using
            // the task_name as a map fallback was producing invalid requests
            // whenever the task name didn't happen to match a real map.
            const mapName =
              args.map_name ||
              fullStatus?.localizationInfo?.map?.name ||
              null;

            // Resolve area ID: match task_name against executableTasks + executingTask
            let areaId: string | undefined;
            if (fullStatus) {
              const executable = fullStatus.executableTasks || [];
              const executing = fullStatus.executingTask;
              const candidates = [...executable];
              if (executing?.id) candidates.push(executing);
              const match = candidates.find(
                (t: any) =>
                  t.name && args.task_name && t.name.toLowerCase() === args.task_name.toLowerCase()
              );
              if (match?.id) areaId = match.id;
            }

            // Default cleaning mode to first available if not provided.
            // Prefer workModes[].name (has IDs) over cleanModes[].name.
            let cleaningMode = args.cleaning_mode;
            if (!cleaningMode) {
              const workModeNames = (fullStatus?.workModes || [])
                .map((m: any) => m.name)
                .filter(Boolean);
              const cleanModeNames = (fullStatus?.cleanModes || [])
                .map((m: any) => m.name)
                .filter(Boolean);
              cleaningMode = workModeNames[0] || cleanModeNames[0] || '清扫';
            }

            // Default task_name when the caller only gave us a cleaning
            // mode — S-line temp tasks still need a task name string.
            const resolvedTaskName =
              args.task_name || `${cleaningMode} on ${mapName || 'map'}`;

            console.log(
              `[gausium] S-line START_TASK for ${sn}: map=${mapName} (${mapId}), ` +
                `area=${areaId || '1'}, mode=${cleaningMode}, task=${resolvedTaskName}`,
            );

            const noSiteBody = buildNoSiteTaskBody(sn, {
              task_name: resolvedTaskName,
              cleaning_mode: cleaningMode,
              map_id: mapId,
              map_name: mapName || undefined,
              area_id: areaId,
            });

            try {
              const result = await gausiumApi.sendNoSiteTask(noSiteBody);
              const verification = await verifyTaskStarted(sn, args.task_name);
              return JSON.stringify({
                success: true,
                data: result,
                endpoint: 'withoutSite',
                ...verification,
              });
            } catch (err: any) {
              console.log('[gausium] sendNoSiteTask failed, trying tempTask:send fallback:', err?.message);
              // 3. Final fallback: v2alpha1 tempTask:send
              const tempBody = buildTempTaskBody(sn, {
                task_name: resolvedTaskName,
                map_id: mapId,
                map_name: mapName || undefined,
                cleaning_mode: cleaningMode,
                area_id: areaId,
              });
              try {
                const result = await gausiumApi.sendTempTask(tempBody);
                const verification = await verifyTaskStarted(sn, args.task_name);
                return JSON.stringify({
                  success: true,
                  data: result,
                  endpoint: 'tempTask',
                  ...verification,
                });
              } catch (err2: any) {
                return JSON.stringify({
                  error: `S-line task submission failed: ${err2?.message || err2}`,
                  endpoint: 'tempTask',
                });
              }
            }
          }
          // Non-S-line (M-line) falls through to the v1alpha1 commands path below.
        }

        // M-line / navigation / other commands — v1alpha1 commands endpoint.
        // CROSS_NAVIGATE now sends position_name directly as a string (the
        // named navigation point), so no site-info lookup is needed.
        const body = buildGausiumCommandBody(sn, commandType, args);

        if (hasGausiumCredentials()) {
          const result = await gausiumApi.sendCommand(sn, body);
          // Extract command UUID from the response `name` field (shape:
          // "robots/{sn}/commands/{uuid}") so the agent can verify acceptance
          // via get_command_status.
          const commandId =
            typeof result?.name === 'string' ? result.name.split('/').pop() || '' : '';
          return JSON.stringify({
            success: true,
            commandId,
            state: result?.state,
            data: result,
          });
        }
        console.log(`[mock-command] ${sn}:`, JSON.stringify(body));
        return JSON.stringify({
          success: true,
          commandId: 'mock-command-id',
          state: 'ACCEPTED',
          data: { message: 'Mock command accepted' },
        });
      }

      case 'get_command_status': {
        const sn = args.serial_number;
        const cmdId = args.command_id;
        if (hasGausiumCredentials()) {
          try {
            const result = await gausiumApi.getCommandStatus(sn, cmdId);
            return JSON.stringify({
              state: result?.state,
              rawCommandType: result?.rawCommandType,
              createTime: result?.createTime,
              updateTime: result?.updateTime,
            });
          } catch (err: any) {
            return JSON.stringify({ error: err?.message || String(err) });
          }
        }
        return JSON.stringify({ state: 'ACCEPTED', rawCommandType: 'mock' });
      }

      case 'get_pudu_tasks': {
        const sn = args.serial_number;
        if (!hasPuduCredentials()) {
          // Dev fallback: synthesize from mock site info so the agent can
          // still reason about the task shape without live credentials.
          const mock = getMockSiteInfo(sn);
          const firstMap = mock.buildings?.[0]?.floors?.[0]?.maps?.[0];
          const mockTasks = (firstMap?.tasks || []).map((t: any, idx: number) => ({
            task_id: t.id || `mock-task-${idx + 1}`,
            version: 1,
            name: t.name,
            desc: '',
            mode: 1,
            mapName: firstMap?.name || null,
            floor: '1',
          }));
          return JSON.stringify(mockTasks);
        }
        try {
          const filter =
            typeof args.map_name === 'string' && args.map_name
              ? { mapName: args.map_name }
              : undefined;
          const tasks = await puduApi.getPuduTaskList(sn, filter);
          puduTaskCache.set(sn, tasks);
          return JSON.stringify(tasks);
        } catch (err: any) {
          console.warn(`[chat-tools] get_pudu_tasks failed for ${sn}: ${err?.message || err}`);
          return JSON.stringify({
            error: err?.message || String(err),
            note: `Failed to fetch Pudu task list for ${sn}.`,
          });
        }
      }

      case 'get_pudu_cleaning_summary': {
        if (!hasPuduCredentials()) {
          return JSON.stringify({
            note: 'Pudu credentials not configured — returning empty mock summary.',
            data: { total_area: 0, total_duration: 0, total_water: 0 },
          });
        }
        if (typeof args.start_time !== 'number' || typeof args.end_time !== 'number') {
          return JSON.stringify({
            error:
              'get_pudu_cleaning_summary requires numeric start_time and end_time (unix seconds).',
          });
        }
        try {
          const result = await puduApi.getPuduCleaningSummary({
            start_time: args.start_time,
            end_time: args.end_time,
            shop_id: typeof args.shop_id === 'number' ? args.shop_id : undefined,
            clean_mode:
              args.clean_mode === 0 || args.clean_mode === 1 || args.clean_mode === 2
                ? args.clean_mode
                : undefined,
            sub_mode: typeof args.sub_mode === 'number' ? args.sub_mode : undefined,
            timezone_offset:
              typeof args.timezone_offset === 'number' ? args.timezone_offset : undefined,
          });
          return JSON.stringify(result);
        } catch (err: any) {
          console.warn(`[chat-tools] get_pudu_cleaning_summary failed: ${err?.message || err}`);
          return JSON.stringify({ error: err?.message || String(err) });
        }
      }

      case 'get_pudu_cleaning_reports': {
        if (!hasPuduCredentials()) {
          return JSON.stringify({
            note: 'Pudu credentials not configured — returning empty mock report list.',
            data: { list: [], total: 0 },
          });
        }
        if (typeof args.start_time !== 'number' || typeof args.end_time !== 'number') {
          return JSON.stringify({
            error:
              'get_pudu_cleaning_reports requires numeric start_time and end_time (unix seconds).',
          });
        }
        try {
          const result = await puduApi.getPuduCleaningReports({
            start_time: args.start_time,
            end_time: args.end_time,
            shop_id: typeof args.shop_id === 'number' ? args.shop_id : undefined,
            offset: typeof args.offset === 'number' ? args.offset : undefined,
            limit: typeof args.limit === 'number' ? args.limit : undefined,
            timezone_offset:
              typeof args.timezone_offset === 'number' ? args.timezone_offset : undefined,
          });
          return JSON.stringify(result);
        } catch (err: any) {
          console.warn(`[chat-tools] get_pudu_cleaning_reports failed: ${err?.message || err}`);
          return JSON.stringify({ error: err?.message || String(err) });
        }
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}
