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
        'Get the current status of a specific robot including battery level, localization state, current map, current task, and position. For Pudu robots also includes clean water and dirty water levels.',
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
        'Get site information for a robot including available buildings, floors, maps, cleaning tasks, and navigation points.',
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
        'Send a command to a robot. IMPORTANT: Always confirm with the user before calling this tool.',
      parameters: {
        type: 'object',
        properties: {
          serial_number: {
            type: 'string',
            description: 'The serial number of the robot',
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
              'STOP_NAVIGATE',
            ],
            description: 'The type of command to send',
          },
          task_name: {
            type: 'string',
            description: 'The task name (required for START_TASK)',
          },
          map_id: {
            type: 'string',
            description: 'The map ID for the command',
          },
          position_name: {
            type: 'string',
            description: 'Target position name (for navigation commands)',
          },
          cleaning_mode: {
            type: 'string',
            description: 'Cleaning mode (optional for START_TASK)',
          },
        },
        required: ['serial_number', 'command_type'],
      },
    },
  },
];

// ── Robot type resolution ──

// Cache of robot type by SN (populated from list_robots calls)
const robotTypeCache = new Map<string, 'gausium' | 'pudu'>();

function getMockRobots() {
  const filePath = path.join(__dirname, '../../test-data/robots.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getRobotType(sn: string): 'gausium' | 'pudu' {
  // Check cache first
  const cached = robotTypeCache.get(sn);
  if (cached) return cached;

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

function getMockStatus(sn: string) {
  const isPudu = getRobotType(sn) === 'pudu';
  return {
    serialNumber: sn,
    battery: 75,
    localized: true,
    currentMap: isPudu ? 'Lobby-Map' : 'Floor-2',
    currentMapId: isPudu ? 'pudu-map-001' : 'map-001',
    currentTask: null,
    taskState: 'idle',
    position: isPudu ? null : { x: 10.5, y: 20.3, angle: 90 },
    ...(isPudu ? { cleanWater: 80, dirtyWater: 25 } : {}),
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
    map_id?: string;
    position_name?: string;
    cleaning_mode?: string;
    positions?: Array<{ name: string; x: number; y: number }>;
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
              map: args.map_id,
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
    case 'CROSS_NAVIGATE': {
      const pos = args.positions?.find(
        (p) => p.name.toLowerCase() === args.position_name?.toLowerCase()
      );
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'CROSS_NAVIGATE',
        commandParameter: {
          startNavigationParameter: {
            map: args.map_id,
            position: pos ? { x: pos.x, y: pos.y } : undefined,
          },
        },
      };
    }
    case 'PAUSE_NAVIGATE':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'PAUSE_NAVIGATE',
        commandParameter: { startNavigationParameter: { map: args.map_id } },
      };
    case 'STOP_NAVIGATE':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'STOP_NAVIGATE',
        commandParameter: { startNavigationParameter: { map: args.map_id } },
      };
    default:
      return { serialNumber: sn };
  }
}

// ── Pudu command helpers ──

// Pudu task cache: sn → PuduTask[] (populated during get_site_info)
const puduTaskCache = new Map<string, puduApi.PuduTask[]>();

async function executePuduCommand(
  sn: string,
  commandType: string,
  args: Record<string, any>
): Promise<string> {
  switch (commandType) {
    case 'START_TASK': {
      // Find task_id and version from cached task list
      const tasks = puduTaskCache.get(sn) || [];
      const match = tasks.find(
        (t) => t.name.toLowerCase() === (args.task_name || '').toLowerCase()
      );
      if (!match) {
        return JSON.stringify({ error: `Task "${args.task_name}" not found. Use get_site_info first to see available tasks.` });
      }
      const taskId = await puduApi.sendPuduCommand(sn, 3, {
        status: 1,
        task_id: match.task_id,
        version: match.version,
      });
      return JSON.stringify({ success: true, data: { task_id: taskId } });
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
      // Pudu doesn't have a distinct resume; re-start with status 1
      const taskId = await puduApi.sendPuduCommand(sn, 3, { status: 1 });
      return JSON.stringify({ success: true, data: { task_id: taskId } });
    }
    case 'CROSS_NAVIGATE':
    case 'STOP_NAVIGATE': {
      // Map navigation to "one-key return" (type 5)
      const taskId = await puduApi.sendPuduCommand(sn, 5);
      return JSON.stringify({ success: true, data: { task_id: taskId, note: 'Sent return-to-base command' } });
    }
    case 'PAUSE_NAVIGATE': {
      // Pause current task
      const taskId = await puduApi.sendPuduCommand(sn, 3, { status: 3 });
      return JSON.stringify({ success: true, data: { task_id: taskId } });
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
          try {
            const gRobots = await gausiumApi.listRobots();
            allRobots.push(...gRobots.map((r) => ({ ...r, robotType: 'gausium' })));
          } catch {
            // Fall through to mock
          }
        }

        // Fetch Pudu robots
        // Pudu doesn't have a list endpoint; robots come from mock data or env config
        // In production, Pudu robots would be configured via PUDU_ROBOT_SNS env var

        // If no real robots fetched, use mock data
        if (allRobots.length === 0) {
          allRobots = getMockRobots();
        } else if (hasPuduCredentials()) {
          // Add Pudu robots from mock/config alongside real Gausium robots
          const puduSns = process.env.PUDU_ROBOT_SNS?.split(',').map((s) => s.trim()).filter(Boolean) || [];
          for (const psn of puduSns) {
            try {
              const status = await puduApi.getPuduRobotStatus(psn);
              allRobots.push({
                serialNumber: psn,
                displayName: status.nickname,
                modelTypeCode: 'Pudu CC1',
                online: status.online,
                robotType: 'pudu',
              });
            } catch {
              allRobots.push({
                serialNumber: psn,
                displayName: psn,
                modelTypeCode: 'Pudu CC1',
                online: false,
                robotType: 'pudu',
              });
            }
          }
        }

        // Update robot type cache
        for (const r of allRobots) {
          if (r.robotType) robotTypeCache.set(r.serialNumber, r.robotType);
        }

        return JSON.stringify(allRobots);
      }

      case 'get_robot_status': {
        const sn = args.serial_number;
        const type = getRobotType(sn);

        if (type === 'pudu') {
          if (hasPuduCredentials()) {
            try {
              const ps = await puduApi.getPuduRobotStatus(sn);
              return JSON.stringify({
                serialNumber: sn,
                battery: ps.battery,
                localized: ps.online, // Pudu doesn't have localization; use online as proxy
                currentMap: ps.mapName,
                currentMapId: null,
                currentTask: ps.currentTask,
                taskState: ps.taskState,
                position: null,
                cleanWater: ps.cleanWater,
                dirtyWater: ps.dirtyWater,
              });
            } catch {
              return JSON.stringify(getMockStatus(sn));
            }
          }
          return JSON.stringify(getMockStatus(sn));
        }

        // Gausium
        if (hasGausiumCredentials()) {
          try {
            const status = await gausiumApi.getRobotStatus(sn);
            return JSON.stringify(status);
          } catch {
            return JSON.stringify(getMockStatus(sn));
          }
        }
        return JSON.stringify(getMockStatus(sn));
      }

      case 'get_site_info': {
        const sn = args.serial_number;
        const type = getRobotType(sn);

        if (type === 'pudu') {
          if (hasPuduCredentials()) {
            try {
              const tasks = await puduApi.getPuduTaskList(sn);
              puduTaskCache.set(sn, tasks);
              // Build SiteInfo-compatible structure from Pudu task list
              return JSON.stringify({
                buildings: [
                  {
                    name: 'Site',
                    floors: [
                      {
                        name: 'Current Floor',
                        maps: [
                          {
                            id: 'pudu-default',
                            name: 'Current Map',
                            tasks: tasks.map((t) => ({
                              name: t.name,
                              id: t.task_id,
                            })),
                            positions: [],
                          },
                        ],
                      },
                    ],
                  },
                ],
              });
            } catch {
              return JSON.stringify(getMockSiteInfo(sn));
            }
          }
          return JSON.stringify(getMockSiteInfo(sn));
        }

        // Gausium
        if (hasGausiumCredentials()) {
          try {
            const site = await gausiumApi.getSiteInfo(sn);
            return JSON.stringify(site);
          } catch {
            return JSON.stringify(getMockSiteInfo(sn));
          }
        }
        return JSON.stringify(getMockSiteInfo(sn));
      }

      case 'send_command': {
        const sn = args.serial_number;
        const commandType = args.command_type;
        const type = getRobotType(sn);

        if (type === 'pudu') {
          if (hasPuduCredentials()) {
            return await executePuduCommand(sn, commandType, args);
          }
          console.log(`[mock-pudu-command] ${sn}: ${commandType}`, JSON.stringify(args));
          return JSON.stringify({ success: true, data: { message: 'Mock Pudu command accepted' } });
        }

        // Gausium path
        let positions: Array<{ name: string; x: number; y: number }> = [];
        if (commandType === 'CROSS_NAVIGATE' && args.position_name) {
          try {
            const site = hasGausiumCredentials()
              ? await gausiumApi.getSiteInfo(sn)
              : getMockSiteInfo(sn);
            for (const b of site.buildings) {
              for (const f of b.floors) {
                for (const m of f.maps) {
                  positions.push(...(m.positions || []));
                }
              }
            }
          } catch {}
        }

        const body = buildGausiumCommandBody(sn, commandType, { ...args, positions });

        if (hasGausiumCredentials()) {
          const result = await gausiumApi.sendCommand(sn, body);
          return JSON.stringify({ success: true, data: result });
        }
        console.log(`[mock-command] ${sn}:`, JSON.stringify(body));
        return JSON.stringify({ success: true, data: { message: 'Mock command accepted' } });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}
