import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { hasGausiumCredentials } from './gausium-auth.js';
import * as gausiumApi from './gausium-api.js';
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
        'List all available Gausium cleaning robots with their serial numbers, display names, model types, and online status.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_robot_status',
      description:
        'Get the current status of a specific robot including battery level, localization state, current map, current task, and position.',
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

// ── Mock data fallbacks ──

function getMockRobots() {
  const filePath = path.join(__dirname, '../../test-data/robots.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getMockStatus(sn: string) {
  return {
    serialNumber: sn,
    battery: 75,
    localized: true,
    currentMap: 'Floor-2',
    currentMapId: 'map-001',
    currentTask: null,
    taskState: 'idle',
    position: { x: 10.5, y: 20.3, angle: 90 },
  };
}

function getMockSiteInfo() {
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

function buildCommandBody(
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

// ── Error Classification ──

interface StructuredError {
  error: 'AUTH_ERROR' | 'COMMAND_REJECTED' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
  reason: string;
  retryable: boolean;
}

function classifyError(err: any): StructuredError {
  const msg = String(err.message || err).toLowerCase();

  // Authentication errors
  if (msg.includes('401') || msg.includes('403') || msg.includes('auth') || msg.includes('token')) {
    return { error: 'AUTH_ERROR', reason: err.message, retryable: true };
  }

  // Command rejections (robot refused the command)
  if (
    msg.includes('400') ||
    msg.includes('409') ||
    msg.includes('422') ||
    msg.includes('rejected') ||
    msg.includes('not localized') ||
    msg.includes('not on a site') ||
    msg.includes('invalid')
  ) {
    return { error: 'COMMAND_REJECTED', reason: err.message, retryable: false };
  }

  // Network / server errors
  if (
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('network') ||
    msg.includes('fetch')
  ) {
    return { error: 'NETWORK_ERROR', reason: err.message, retryable: true };
  }

  return { error: 'UNKNOWN_ERROR', reason: err.message, retryable: false };
}

// ── Tool Executor ──

export async function executeTool(
  name: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (name) {
      case 'list_robots': {
        let robots;
        if (hasGausiumCredentials()) {
          try {
            robots = await gausiumApi.listRobots();
          } catch {
            robots = getMockRobots();
          }
        } else {
          robots = getMockRobots();
        }
        return JSON.stringify(robots);
      }

      case 'get_robot_status': {
        const sn = args.serial_number;
        let status;
        if (hasGausiumCredentials()) {
          try {
            status = await gausiumApi.getRobotStatus(sn);
          } catch {
            status = getMockStatus(sn);
          }
        } else {
          status = getMockStatus(sn);
        }
        return JSON.stringify(status);
      }

      case 'get_site_info': {
        const sn = args.serial_number;
        let site;
        if (hasGausiumCredentials()) {
          try {
            site = await gausiumApi.getSiteInfo(sn);
          } catch {
            site = getMockSiteInfo();
          }
        } else {
          site = getMockSiteInfo();
        }
        return JSON.stringify(site);
      }

      case 'send_command': {
        const sn = args.serial_number;
        const commandType = args.command_type;

        // For navigation, we need positions from site info
        let positions: Array<{ name: string; x: number; y: number }> = [];
        if (commandType === 'CROSS_NAVIGATE' && args.position_name) {
          try {
            const site = hasGausiumCredentials()
              ? await gausiumApi.getSiteInfo(sn)
              : getMockSiteInfo();
            for (const b of site.buildings) {
              for (const f of b.floors) {
                for (const m of f.maps) {
                  positions.push(...(m.positions || []));
                }
              }
            }
          } catch (posErr: any) {
            console.warn(`[chat-tools] Failed to fetch positions for navigation: ${posErr.message}`);
          }
        }

        const body = buildCommandBody(sn, commandType, { ...args, positions });

        // Log navigation commands for format verification (#10)
        if (commandType === 'CROSS_NAVIGATE') {
          console.log(`[chat-tools] CROSS_NAVIGATE request body:`, JSON.stringify(body, null, 2));
        }

        if (hasGausiumCredentials()) {
          try {
            const result = await gausiumApi.sendCommand(sn, body);
            if (commandType === 'CROSS_NAVIGATE') {
              console.log(`[chat-tools] CROSS_NAVIGATE response:`, JSON.stringify(result));
            }
            return JSON.stringify({ success: true, data: result });
          } catch (cmdErr: any) {
            // Structured error feedback (#4)
            const structured = classifyError(cmdErr);
            console.error(`[chat-tools] Command ${commandType} failed:`, structured);
            return JSON.stringify(structured);
          }
        }
        console.log(`[mock-command] ${sn}:`, JSON.stringify(body));
        return JSON.stringify({ success: true, data: { message: 'Mock command accepted' } });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err: any) {
    const structured = classifyError(err);
    return JSON.stringify(structured);
  }
}
