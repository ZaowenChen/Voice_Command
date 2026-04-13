import { getAccessToken } from './gausium-auth.js';
import type { Robot, RobotStatus, SiteInfo } from '../types/index.js';

const BASE = 'https://openapi.gs-robot.com';

async function gausiumFetch(path: string, options: RequestInit = {}) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

export async function getSiteInfo(sn: string): Promise<SiteInfo> {
  try {
    const data = await gausiumFetch(`/openapi/v2alpha1/robots/${sn}/getSiteInfo`);
    const siteData = data.data || data;
    if (siteData.code && siteData.message) {
      throw new Error(siteData.message);
    }
    return siteData;
  } catch {
    // Fall back to building site info from status data
    const statusData = await gausiumFetch(`/v1alpha1/robots/${sn}/status`);
    return buildSiteInfoFromStatus(statusData);
  }
}

function buildSiteInfoFromStatus(statusData: any): SiteInfo {
  const mapInfo = statusData.localizationInfo?.map;
  const executableTasks = statusData.executableTasks || [];
  const executingTask = statusData.executingTask;

  const tasks = executableTasks.map((t: any) => ({ name: t.name, id: t.id }));
  if (executingTask?.name && !tasks.find((t: any) => t.name === executingTask.name)) {
    tasks.push({ name: executingTask.name, id: executingTask.id });
  }

  // Navigation positions are not available from status, return empty
  const mapEntry = {
    id: mapInfo?.id || 'unknown',
    name: mapInfo?.name || 'Unknown Map',
    tasks,
    positions: [],
  };

  return {
    buildings: [
      {
        name: 'Site',
        floors: [
          {
            name: 'Current Floor',
            maps: [mapEntry],
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
