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

    // Fetch Pudu robots from env config. `robot/detail` doesn't expose the
    // model — product_code lives on the V2 status endpoint (§3.1). We fetch
    // both in parallel so either failing doesn't hide the robot.
    if (hasPuduCredentials()) {
      const puduSns = process.env.PUDU_ROBOT_SNS?.split(',').map((s) => s.trim()).filter(Boolean) || [];
      for (const psn of puduSns) {
        const [statusRes, v2Res] = await Promise.allSettled([
          puduApi.getPuduRobotStatus(psn),
          puduApi.getPuduRobotStatusV2(psn),
        ]);
        const status = statusRes.status === 'fulfilled' ? statusRes.value : null;
        const v2 = v2Res.status === 'fulfilled' ? v2Res.value : null;
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
      // Fetch detail + V2 status in parallel — V2 carries `product_code`
      // (the model) and `run_state`. `robot/detail` has no model field.
      const [psRes, v2Res] = await Promise.allSettled([
        puduApi.getPuduRobotStatus(sn),
        puduApi.getPuduRobotStatusV2(sn),
      ]);
      if (psRes.status !== 'fulfilled') throw psRes.reason;
      const ps = psRes.value;
      const v2 = v2Res.status === 'fulfilled' ? v2Res.value : null;
      const productCode =
        typeof v2?.product_code === 'string' && v2.product_code
          ? v2.product_code
          : null;
      return res.json({
        serialNumber: sn,
        battery: ps.battery,
        // §1.5 exposes `cleanbot.task === -200` (LostLocation) on polling,
        // so we now flag delocalization from the detail response itself.
        // Transient drift still needs the `robotErrorNotice` webhook — but
        // this at least catches the durable "robot needs re-localize" case
        // that otherwise quietly returns empty/wrong task lists.
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
        displayName: ps.nickname,
        modelTypeCode: productCode ? `Pudu ${productCode}` : 'Pudu',
        shopName: ps.shopName ?? undefined,
        robotType: 'pudu',
      });
    }

    if (type === 'gausium' && hasGausiumCredentials()) {
      const status = await gausiumApi.getRobotStatus(sn);
      return res.json({ ...status, robotType: 'gausium' });
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

      // If the robot is delocalized, its reported `map.name` is stale and
      // any filter built from it will be nonsense — skip the map filter and
      // surface a clear banner instead of silently showing wrong tasks.
      // Otherwise filter strictly to the current map (no cross-map leakage).
      const tasks = ps.localized
        ? await puduApi.getPuduTaskList(sn, { mapName: ps.mapName })
        : [];

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

      // Friendly note for the empty cases so the UI can show *why* there
      // are no tasks rather than appearing broken.
      let note: string | undefined;
      if (!ps.localized) {
        note =
          `Robot is not localized (activity code ${ps.robotActivityCode}). ` +
          `Re-localize it on the robot UI — the cloud can't list tasks reliably ` +
          `until the robot confirms which map it's on.`;
      } else if (tasks.length === 0) {
        note =
          `No cleaning tasks are defined on the robot's current map "${currentMap}". ` +
          `Create a task on this map from the Pudu app, or switch the robot to a map ` +
          `that already has tasks saved.`;
      }

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
        localized: ps.localized,
        currentMap,
        note,
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

// ── Debug: raw Gausium dump ──
// GET /api/debug/gausium/:sn — returns the raw v1 status, v2 S-line status,
// v2 getSiteInfo, and robot map list responses side-by-side. Use this to
// see exactly what Gausium is reporting for a specific robot.
router.get('/debug/gausium/:sn', async (req, res) => {
  const { sn } = req.params;
  if (!hasGausiumCredentials()) {
    return res.status(400).json({ error: 'Gausium credentials not configured' });
  }
  try {
    const [v1Status, sLineStatus, rawSite, maps] = await Promise.all([
      gausiumApi.getRobotFullStatus(sn).catch((e: any) => ({ __error: e?.message || String(e) })),
      gausiumApi.getSLineStatusRaw(sn),
      gausiumApi.getRawSiteInfoDebug(sn),
      gausiumApi.listRobotMaps(sn).catch(() => []),
    ]);
    const summary = {
      executableTaskCount: Array.isArray(v1Status?.executableTasks)
        ? v1Status.executableTasks.length
        : 0,
      executableTaskNames: (v1Status?.executableTasks || []).map((t: any) => t?.name),
      cleanModeNames: (v1Status?.cleanModes || []).map((m: any) => m?.name),
      workModeNames: (v1Status?.workModes || []).map((m: any) => m?.name),
      currentMapName: v1Status?.localizationInfo?.map?.name ?? null,
      currentMapId: v1Status?.localizationInfo?.map?.id ?? null,
      executingTaskName: v1Status?.executingTask?.name ?? null,
      executingTaskId: v1Status?.executingTask?.id ?? null,
      taskState: v1Status?.taskState ?? null,
      v1StatusTopLevelKeys: v1Status ? Object.keys(v1Status) : [],
      sLineStatusTopLevelKeys: sLineStatus ? Object.keys(sLineStatus) : null,
      mapCount: maps?.length ?? 0,
      mapNames: (maps || []).map((m: any) => m.mapName),
    };
    res.json({ summary, v1_status_raw: v1Status, s_line_status_raw: sLineStatus, raw_site_info: rawSite, robot_maps_raw: maps });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    const [detail, taskList, availableMaps, currentMap, v2Status] = await Promise.all([
      puduApi.getPuduRobotDetailRaw(sn),
      puduApi.getPuduTaskListRaw(sn),
      puduApi.getPuduAvailableMaps(sn).catch((e: any) => ({ __error: e?.message || String(e) })),
      puduApi.getPuduCurrentMap(sn).catch((e: any) => ({ __error: e?.message || String(e) })),
      puduApi.getPuduRobotStatusV2(sn).catch((e: any) => ({ __error: e?.message || String(e) })),
    ]);

    const activityCode =
      typeof detail?.data?.cleanbot?.task === 'number'
        ? detail.data.cleanbot.task
        : null;
    const detailMapName = detail?.data?.map?.name ?? null;
    const taskItems: any[] = taskList?.data?.item || [];
    const activeTaskItems = taskItems.filter((t) => t.status !== -1);

    const taskMapNames = Array.from(
      new Set(
        activeTaskItems.flatMap((t) =>
          (t.floor_list || []).map((f: any) => f?.map?.name).filter(Boolean)
        )
      )
    ).sort();

    const tasksOnCurrentMap = detailMapName
      ? activeTaskItems
          .filter((t) =>
            (t.floor_list || []).some(
              (f: any) => f?.map?.name === detailMapName
            )
          )
          .map((t) => t.name)
      : [];

    // Core diagnosis: one number that tells you *why* tasks are missing.
    let diagnosis: string;
    if (activityCode === -200) {
      diagnosis =
        'ROBOT_DELOCALIZED — cleanbot.task === -200 (LostLocation, §1.5). ' +
        'Re-localize on the robot UI; task filtering by current map is unreliable until it re-localizes.';
    } else if (!detailMapName) {
      diagnosis =
        'NO_CURRENT_MAP — robot/detail reported no map. Likely not localized, or robot has no map loaded.';
    } else if (activeTaskItems.length === 0) {
      diagnosis =
        'NO_TASKS_RETURNED — task/list returned 0 active tasks for this SN. Tasks may be saved locally on the robot but not synced to the cloud, or the ApiAppKey lacks scope to this store.';
    } else if (tasksOnCurrentMap.length === 0) {
      diagnosis =
        `MAP_NAME_MISMATCH — robot is on "${detailMapName}" but no task.floor_list[].map.name matches it exactly. ` +
        `Pudu map names are "floor#id#descriptive" and exact match is required. Compare task_map_names vs robot_current_map.name. ` +
        `A re-saved map bumps the embedded id; tasks tied to the old id won't match the new one.`;
    } else {
      diagnosis = `OK — ${tasksOnCurrentMap.length} task(s) exactly match the robot's current map name.`;
    }

    const summary = {
      diagnosis,
      robot_current_map: detail?.data?.map ?? null,
      robot_online: detail?.data?.online ?? null,
      robot_activity_code: activityCode,
      robot_localized: activityCode !== -200,
      robot_product_code: (v2Status as any)?.product_code ?? null,
      robot_run_state: (v2Status as any)?.run_state ?? null,
      robot_shop: detail?.data?.shop ?? null,
      robot_mac: detail?.data?.mac ?? null,
      task_count_reported: taskList?.data?.count ?? 0,
      task_count_active: activeTaskItems.length,
      task_count_deleted: taskItems.length - activeTaskItems.length,
      tasks_on_current_map: tasksOnCurrentMap,
      task_map_names: taskMapNames,
      task_names: activeTaskItems.map((t) => t.name),
      available_maps: availableMaps,
      current_map_per_map_service: currentMap,
    };
    res.json({
      summary,
      robot_detail_raw: detail,
      task_list_raw: taskList,
      available_maps_raw: availableMaps,
      current_map_raw: currentMap,
      v2_status_raw: v2Status,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
