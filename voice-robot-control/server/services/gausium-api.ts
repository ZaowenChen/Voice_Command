import { getAccessToken } from './gausium-auth.js';
import type { Robot, RobotStatus, SiteInfo, RawSiteInfo } from '../types/index.js';

const BASE = 'https://openapi.gs-robot.com';

async function gausiumFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();
  // v2 endpoints need grpc-web content type for GET, v1 uses JSON
  const isV2 = path.includes('v2alpha1');
  const defaultContentType = isV2 && !options.method
    ? 'application/grpc-web+proto'
    : 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': defaultContentType,
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gausium API ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function listRobots(): Promise<Robot[]> {
  const data = await gausiumFetch('/v1alpha1/robots?page=1&pageSize=50&relation=contract');
  const robots = data.data?.robots || data.robots || [];
  return robots.map((r: any) => ({
    serialNumber: r.serialNumber,
    displayName: r.displayName || r.serialNumber,
    modelTypeCode: r.modelTypeCode || 'Unknown',
    online: r.online ?? false,
  }));
}

export async function getRobotStatus(sn: string): Promise<RobotStatus> {
  const data = await gausiumFetch(`/v1alpha1/robots/${sn}/status`);
  const s = data;
  console.log(
    `[gausium] Status ${sn}: online=${s.online}, battery=${s.battery?.powerPercentage}%, ` +
      `localized=${s.localizationInfo?.localizationState}, map=${s.localizationInfo?.map?.name}, ` +
      `task=${s.executingTask?.name || 'none'}, taskState=${s.taskState}`,
  );
  const locState = s.localizationInfo?.localizationState;
  const isLocalized = locState === 'NORMAL' || locState === 'LOCALIZED';
  const mapInfo = s.localizationInfo?.map;
  const executingTask = s.executingTask;
  const taskState = s.taskState || 'OTHER';

  return {
    serialNumber: sn,
    battery: s.battery?.powerPercentage ?? 0,
    localized: isLocalized,
    currentMap: mapInfo?.name ?? null,
    currentMapId: mapInfo?.id ?? null,
    currentTask: executingTask?.name ?? null,
    taskState: mapTaskState(taskState),
    position: s.localizationInfo?.mapPosition
      ? {
          x: s.localizationInfo.mapPosition.x,
          y: s.localizationInfo.mapPosition.y,
          angle: s.localizationInfo.mapPosition.angle,
        }
      : null,
    cleanModes: (s.cleanModes || []).map((m: any) => m.name).filter(Boolean),
  };
}

// Also fetch tasks/clean modes from the v1 status response
export async function getRobotFullStatus(sn: string) {
  const data = await gausiumFetch(`/v1alpha1/robots/${sn}/status`);
  return data;
}

function mapTaskState(state: string | undefined): RobotStatus['taskState'] {
  if (!state) return 'idle';
  const s = String(state).toLowerCase();
  if (s.includes('run') || s.includes('executing')) return 'running';
  if (s.includes('pause')) return 'paused';
  if (s.includes('error') || s.includes('fail')) return 'error';
  return 'idle';
}

export async function listRobotMaps(sn: string): Promise<Array<{ mapId: string; mapName: string }>> {
  try {
    const data = await gausiumFetch('/openapi/v1/map/robotMap/list', {
      method: 'POST',
      body: JSON.stringify({ robotSn: sn }),
    });
    return data.data || [];
  } catch {
    return [];
  }
}

/**
 * Fetch the raw getSiteInfo response without normalization.
 * Returns null if the robot is not on a site or the call fails.
 * The raw response is needed to build the v2 "withSite" S-line task body.
 */
export async function getRawSiteInfo(sn: string): Promise<RawSiteInfo | null> {
  try {
    const data = await gausiumFetch(`/openapi/v2alpha1/robots/${sn}/getSiteInfo`);
    const siteData = data.data || data;
    if (siteData.code && siteData.message) {
      console.warn(`[gausium] getSiteInfo ${sn}: ${siteData.message}`);
      return null;
    }
    return siteData as RawSiteInfo;
  } catch (err: any) {
    // Extract the core message (e.g. "The robot is not on a site") without the full JSON body
    const msg = String(err?.message || err);
    const match = msg.match(/"message":\s*"([^"]+)"/);
    console.warn(`[gausium] getSiteInfo failed for ${sn}: ${match?.[1] || msg.split('\n')[0]}`);
    return null;
  }
}

export async function getSiteInfo(sn: string): Promise<SiteInfo> {
  const raw = await getRawSiteInfo(sn);
  if (raw && raw.buildings) {
    // Normalize raw site info into the UI-facing SiteInfo shape.
    return normalizeRawSiteInfo(raw);
  }
  // Robot isn't on a site — build a best-effort SiteInfo from status + map list,
  // and flag that this is fallback data so callers (and GPT) know.
  console.warn(`[gausium] Building site info from status for ${sn} (robot not on a site)`);
  const [statusData, maps] = await Promise.all([
    gausiumFetch(`/v1alpha1/robots/${sn}/status`),
    listRobotMaps(sn),
  ]);
  const site = buildSiteInfoFromStatus(statusData, maps);
  site.notOnSite = true;
  site.note = 'Robot is not assigned to a site; site info built from robot status.';
  return site;
}

function normalizeRawSiteInfo(raw: RawSiteInfo): SiteInfo {
  const buildings = (raw.buildings || []).map((b) => ({
    name: b.name || 'Building',
    floors: (b.floors || []).map((f) => ({
      name: f.name || `Floor ${f.index ?? ''}`.trim(),
      maps: (f.maps || []).map((m) => ({
        id: m.id || 'unknown',
        name: m.name || 'Unknown Map',
        tasks: (m.tasks || m.areas || []).map((t: any) => ({
          name: t.name || 'Unnamed',
          id: t.id,
        })),
        positions: [],
      })),
    })),
  }));
  return { buildings: buildings.length > 0 ? buildings : [] };
}

function buildSiteInfoFromStatus(
  statusData: any,
  robotMaps: Array<{ mapId: string; mapName: string }> = [],
): SiteInfo {
  const mapInfo = statusData.localizationInfo?.map;
  const executableTasks = statusData.executableTasks || [];
  const executingTask = statusData.executingTask;
  const workModes = statusData.workModes || [];

  const tasks = executableTasks.map((t: any) => ({ name: t.name, id: t.id }));
  if (executingTask?.name && !tasks.find((t: any) => t.name === executingTask.name)) {
    tasks.push({ name: executingTask.name, id: executingTask.id });
  }

  // Build map entries from V2 map list (or fall back to current map from status)
  const mapEntries: any[] = [];
  if (robotMaps.length > 0) {
    for (const m of robotMaps) {
      const entry: any = {
        id: m.mapId,
        name: m.mapName,
        tasks: mapInfo?.id === m.mapId ? tasks : [],
        positions: [],
      };
      // Attach workModes to the current map
      if (mapInfo?.id === m.mapId && workModes.length > 0) {
        entry.workModes = workModes.map((wm: any) => ({
          id: wm.id,
          name: wm.name,
          type: wm.type,
        }));
      }
      mapEntries.push(entry);
    }
  } else {
    // No map list available — use current map from status
    const entry: any = {
      id: mapInfo?.id || 'unknown',
      name: mapInfo?.name || 'Unknown Map',
      tasks,
      positions: [],
    };
    if (workModes.length > 0) {
      entry.workModes = workModes.map((wm: any) => ({
        id: wm.id,
        name: wm.name,
        type: wm.type,
      }));
    }
    mapEntries.push(entry);
  }

  return {
    buildings: [
      {
        name: 'Site',
        floors: [
          {
            name: 'Current Floor',
            maps: mapEntries,
          },
        ],
      },
    ],
  };
}

export async function sendCommand(sn: string, commandBody: any): Promise<any> {
  return gausiumFetch(`/v1alpha1/robots/${sn}/commands`, {
    method: 'POST',
    body: JSON.stringify(commandBody),
  });
}

/**
 * S-line task submission — robot IS on a site.
 * POST /openapi/v2/robot/tasks/temp/withSite
 * Requires the full site-aware body with siteId, siteName, floors[], tasks[].
 */
export async function sendSiteTask(taskBody: any): Promise<any> {
  console.log('[gausium] sendSiteTask body:', JSON.stringify(taskBody, null, 2));
  const result = await gausiumFetch('/openapi/v2/robot/tasks/temp/withSite', {
    method: 'POST',
    body: JSON.stringify(taskBody),
  });
  console.log('[gausium] sendSiteTask response:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * S-line task submission — robot is NOT on a site (standalone).
 * POST /openapi/v2/robot/tasks/temp/withoutSite
 * Body shape:
 * {
 *   productId: "<sn>",
 *   tempTaskCommand: {
 *     cleaningMode: "清扫",
 *     loop: false,
 *     loopCount: 1,
 *     taskName: "Main-1",
 *     mapName: "Main-1",
 *     startParam: [ { mapId: "<uuid>", areaId: "1" } ]
 *   }
 * }
 */
export async function sendNoSiteTask(taskBody: any): Promise<any> {
  console.log('[gausium] sendNoSiteTask body:', JSON.stringify(taskBody, null, 2));
  const result = await gausiumFetch('/openapi/v2/robot/tasks/temp/withoutSite', {
    method: 'POST',
    body: JSON.stringify(taskBody),
  });
  console.log('[gausium] sendNoSiteTask response:', JSON.stringify(result, null, 2));
  return result;
}

/**
 * S-line task submission (v2alpha1 alternative, kept as an additional fallback).
 * POST /v2alpha1/robotCommand/tempTask:send
 */
export async function sendTempTask(taskBody: any): Promise<any> {
  console.log('[gausium] sendTempTask body:', JSON.stringify(taskBody, null, 2));
  const result = await gausiumFetch('/v2alpha1/robotCommand/tempTask:send', {
    method: 'POST',
    body: JSON.stringify(taskBody),
  });
  console.log('[gausium] sendTempTask response:', JSON.stringify(result, null, 2));
  return result;
}
