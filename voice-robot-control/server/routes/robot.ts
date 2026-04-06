import { Router } from 'express';
import { hasGausiumCredentials } from '../services/gausium-auth.js';
import * as gausiumApi from '../services/gausium-api.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

// Mock data for when Gausium credentials are not available
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
    taskState: 'idle' as const,
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

// GET /api/robots
router.get('/robots', async (_req, res) => {
  try {
    if (hasGausiumCredentials()) {
      const robots = await gausiumApi.listRobots();
      return res.json(robots);
    }
    res.json(getMockRobots());
  } catch (err: any) {
    console.error('[robots] Error:', err.message);
    res.json(getMockRobots());
  }
});

// GET /api/robots/:sn/status
router.get('/robots/:sn/status', async (req, res) => {
  const { sn } = req.params;
  try {
    if (hasGausiumCredentials()) {
      const status = await gausiumApi.getRobotStatus(sn);
      return res.json(status);
    }
    res.json(getMockStatus(sn));
  } catch (err: any) {
    console.error(`[status] Error for ${sn}:`, err.message);
    res.json(getMockStatus(sn));
  }
});

// GET /api/robots/:sn/site
router.get('/robots/:sn/site', async (req, res) => {
  const { sn } = req.params;
  try {
    if (hasGausiumCredentials()) {
      const site = await gausiumApi.getSiteInfo(sn);
      return res.json(site);
    }
    res.json(getMockSiteInfo());
  } catch (err: any) {
    console.error(`[site] Error for ${sn}:`, err.message);
    res.json(getMockSiteInfo());
  }
});

// POST /api/robots/:sn/commands
router.post('/robots/:sn/commands', async (req, res) => {
  const { sn } = req.params;
  try {
    if (hasGausiumCredentials()) {
      const result = await gausiumApi.sendCommand(sn, req.body);
      return res.json({ success: true, data: result });
    }
    // Mock: just echo success
    console.log(`[mock-command] ${sn}:`, JSON.stringify(req.body));
    res.json({ success: true, data: { message: 'Mock command accepted' } });
  } catch (err: any) {
    console.error(`[command] Error for ${sn}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
