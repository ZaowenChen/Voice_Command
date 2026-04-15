import { Router } from 'express';
import { hasGausiumCredentials } from '../services/gausium-auth.js';
import { hasPuduCredentials } from '../services/pudu-api.js';
import * as gausiumApi from '../services/gausium-api.js';
import * as puduApi from '../services/pudu-api.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// ── Robot type resolution ──

function getMockRobots() {
  const filePath = path.join(__dirname, '../../test-data/robots.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function getRobotType(sn: string): 'gausium' | 'pudu' {
  // Check env-configured SNs first
  const gausiumSns = process.env.GAUSIUM_ROBOT_SNS?.split(',').map((s) => s.trim()) || [];
  if (gausiumSns.includes(sn)) return 'gausium';
  const puduSns = process.env.PUDU_ROBOT_SNS?.split(',').map((s) => s.trim()) || [];
  if (puduSns.includes(sn)) return 'pudu';

  // Check mock data
  const mockRobots = getMockRobots();
  const match = mockRobots.find((r: any) => r.serialNumber === sn);
  if (match?.robotType) return match.robotType;
  if (hasPuduCredentials() && !hasGausiumCredentials()) return 'pudu';
  return 'gausium';
}

// ── Mock data ──

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
  return {
    serialNumber: sn,
    battery: 75,
    localized: true,
    currentMap: isPudu ? 'Lobby-Map' : 'Floor-2',
    currentMapId: isPudu ? 'pudu-map-001' : 'map-001',
    currentTask: null,
    taskState: 'idle' as const,
    position: isPudu ? null : { x: 10.5, y: 20.3, angle: 90 },
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
                  { name: 'Elevator', x: 15.0, y: 8.0 },
                ],
              },
            ],
          },
          {
            name: 'Floor 2',
            maps: [
              {
                id: 'map-002',
                name: 'Floor-2',
                tasks: [
                  { name: 'Full Clean F2', id: 'task-003' },
                  { name: 'Area A Clean', id: 'task-004' },
                  { name: 'Area B Clean', id: 'task-005' },
                ],
                positions: [
                  { name: 'Conference Room', x: 20.0, y: 15.0 },
                  { name: 'Break Room', x: 8.0, y: 12.0 },
                  { name: 'Charger F2', x: 2.0, y: 2.0 },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

// ── Routes ──

// GET /api/robots
router.get('/robots', async (_req, res) => {
  try {
    let allRobots: any[] = [];

    // Fetch Gausium robots
    if (hasGausiumCredentials()) {
      const gausiumSns = process.env.GAUSIUM_ROBOT_SNS?.split(',').map((s) => s.trim()).filter(Boolean) || [];

      // Always try the list API first to get proper display names and model types
      let listedRobots: any[] = [];
      try {
        const gRobots = await gausiumApi.listRobots();
        listedRobots = gRobots.map((r) => ({ ...r, robotType: 'gausium' }));
      } catch (err: any) {
        console.error('[robots] Gausium list error:', err.message);
      }

      if (gausiumSns.length > 0) {
        // Filter to only the configured SNs, enriching with list data when available
        for (const gsn of gausiumSns) {
          const listed = listedRobots.find((r: any) => r.serialNumber === gsn);
          if (listed) {
            allRobots.push(listed);
          } else {
            // SN not in list response — fetch status to check if online
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
        // No hardcoded SNs — use all robots from list API
        allRobots.push(...listedRobots);
      }
    }

    // Fetch Pudu robots from env config
    if (hasPuduCredentials()) {
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

    // Only fall back to mock data when NEITHER provider has credentials (dev mode)
    if (allRobots.length === 0 && !hasGausiumCredentials() && !hasPuduCredentials()) {
      allRobots = getMockRobots();
    }

    res.json(allRobots);
  } catch (err: any) {
    console.error('[robots] Error:', err.message);
    // With real credentials configured, don't silently serve mock data
    if (hasGausiumCredentials() || hasPuduCredentials()) {
      return res.status(502).json({ error: err.message });
    }
    res.json(getMockRobots());
  }
});

// GET /api/robots/:sn/status
router.get('/robots/:sn/status', async (req, res) => {
  const { sn } = req.params;
  const type = getRobotType(sn);
  const hasRealCreds = (type === 'pudu' && hasPuduCredentials()) || (type === 'gausium' && hasGausiumCredentials());

  try {
    if (type === 'pudu' && hasPuduCredentials()) {
      const ps = await puduApi.getPuduRobotStatus(sn);
      return res.json({
        serialNumber: sn,
        battery: ps.battery,
        localized: ps.online,
        currentMap: ps.mapName,
        currentMapId: null,
        currentTask: ps.currentTask,
        taskState: ps.taskState,
        position: null,
        cleanWater: ps.cleanWater,
        dirtyWater: ps.dirtyWater,
      });
    }

    if (type === 'gausium' && hasGausiumCredentials()) {
      const status = await gausiumApi.getRobotStatus(sn);
      return res.json(status);
    }

    // No credentials for this provider → dev mode mock
    res.json(getMockStatus(sn));
  } catch (err: any) {
    console.error(`[status] Error for ${sn}: ${err.message}`);
    if (hasRealCreds) {
      return res.status(502).json({ error: err.message });
    }
    res.json(getMockStatus(sn));
  }
});

// GET /api/robots/:sn/site
router.get('/robots/:sn/site', async (req, res) => {
  const { sn } = req.params;
  const type = getRobotType(sn);
  const hasRealCreds = (type === 'pudu' && hasPuduCredentials()) || (type === 'gausium' && hasGausiumCredentials());

  try {
    if (type === 'pudu' && hasPuduCredentials()) {
      const ps = await puduApi.getPuduRobotStatus(sn);
      const tasks = await puduApi.getPuduTaskList(sn, {
        mapName: ps.mapName,
        mapLv: ps.mapLv,
      });

      // Group tasks by map so duplicate names (e.g. two "Carpet Run"
      // entries on different maps) are distinguishable in the sidebar.
      const currentMap = ps.mapName || 'Current Map';
      const byMap = new Map<string, typeof tasks>();
      for (const t of tasks) {
        const key = t.mapName || currentMap;
        if (!byMap.has(key)) byMap.set(key, []);
        byMap.get(key)!.push(t);
      }
      const mapNames = Array.from(byMap.keys()).sort((a, b) => {
        if (a === currentMap) return -1;
        if (b === currentMap) return 1;
        return a.localeCompare(b);
      });

      return res.json({
        buildings: [
          {
            name: ps.shopName || 'Site',
            floors: [
              {
                name: `Robot is on: ${currentMap}`,
                maps: mapNames.map((mapName) => ({
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
      });
    }

    if (type === 'gausium' && hasGausiumCredentials()) {
      const site = await gausiumApi.getSiteInfo(sn);
      return res.json(site);
    }

    // No credentials → dev mode mock
    res.json(getMockSiteInfo(sn));
  } catch (err: any) {
    console.error(`[site] Error for ${sn}: ${err.message}`);
    if (hasRealCreds) {
      return res.status(502).json({ error: err.message, notOnSite: true });
    }
    res.json(getMockSiteInfo(sn));
  }
});

// POST /api/robots/:sn/commands
router.post('/robots/:sn/commands', async (req, res) => {
  const { sn } = req.params;
  const type = getRobotType(sn);

  try {
    if (type === 'pudu' && hasPuduCredentials()) {
      // For direct REST calls, expect Pudu command format in body
      const { type: cmdType, clean } = req.body;
      const taskId = await puduApi.sendPuduCommand(sn, cmdType, clean);
      return res.json({ success: true, data: { task_id: taskId } });
    }

    if (type === 'gausium' && hasGausiumCredentials()) {
      const result = await gausiumApi.sendCommand(sn, req.body);
      return res.json({ success: true, data: result });
    }

    // Mock
    console.log(`[mock-command] ${sn}:`, JSON.stringify(req.body));
    res.json({ success: true, data: { message: 'Mock command accepted' } });
  } catch (err: any) {
    console.error(`[command] Error for ${sn}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Debug: raw Pudu dump ──
// GET /api/debug/pudu/:sn — returns the raw robot/detail and task/list
// responses from Pudu with no filtering, grouping, or transformation.
// Use this to see exactly what Pudu is reporting, end-to-end.
router.get('/debug/pudu/:sn', async (req, res) => {
  const { sn } = req.params;
  if (!hasPuduCredentials()) {
    return res.status(400).json({ error: 'Pudu credentials not configured' });
  }
  try {
    const detail = await puduApi.getPuduRobotDetailRaw(sn);
    const taskList = await puduApi.getPuduTaskListRaw(sn);
    // Extract just the fields that matter for the missing-task diagnosis
    const summary = {
      robot_current_map: detail?.data?.map ?? null,
      robot_shop: detail?.data?.shop ?? null,
      robot_mac: detail?.data?.mac ?? null,
      task_count: taskList?.data?.count ?? 0,
      task_map_names: Array.from(
        new Set(
          (taskList?.data?.item || []).flatMap((t: any) =>
            (t.floor_list || []).map((f: any) => f?.map?.name).filter(Boolean)
          )
        )
      ).sort(),
      task_names: (taskList?.data?.item || []).map((t: any) => t.name),
    };
    res.json({ summary, robot_detail_raw: detail, task_list_raw: taskList });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
