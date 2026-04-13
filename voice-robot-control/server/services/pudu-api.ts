const BASE = process.env.PUDU_BASE_URL || 'https://open.pudutech.com';

export function hasPuduCredentials(): boolean {
  return !!process.env.PUDU_API_KEY;
}

async function puduFetch(path: string, options: RequestInit = {}) {
  const token = process.env.PUDU_API_KEY;
  if (!token) throw new Error('Pudu API key not configured');

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
    throw new Error(`Pudu API ${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ── Types ──

export interface PuduRobotStatus {
  serialNumber: string;
  nickname: string;
  online: boolean;
  battery: number;
  mapName: string | null;
  taskState: 'idle' | 'running' | 'paused' | 'error';
  currentTask: string | null;
  cleanWater: number;    // rising (0-100)
  dirtyWater: number;    // sewage (0-100)
  shopName: string | null;
}

export interface PuduTask {
  task_id: string;
  version: number;
  name: string;
  desc: string;
  mode: number; // 1=mop, 2=sweep
}

// ── Machine state code → taskState mapping ──

function mapPuduCleanStatus(status: number | null | undefined): PuduRobotStatus['taskState'] {
  switch (status) {
    case 1: return 'running';
    case 2: return 'paused';
    case 3: return 'error';   // interrupted
    case 5: return 'error';
    case 0:
    case 4:
    case 6:
    default: return 'idle';
  }
}

// ── API Functions ──

export async function getPuduRobotStatus(sn: string): Promise<PuduRobotStatus> {
  const data = await puduFetch(`/cleanbot-service/v1/api/open/robot/detail?sn=${encodeURIComponent(sn)}`);
  const d = data.data || data;

  const cleanStatus = d.cleanbot?.clean?.result?.status ?? null;

  return {
    serialNumber: sn,
    nickname: d.nickname || sn,
    online: d.online ?? false,
    battery: d.battery ?? 0,
    mapName: d.map?.name ?? null,
    taskState: mapPuduCleanStatus(cleanStatus),
    currentTask: d.cleanbot?.clean?.result ? d.cleanbot.clean.name || null : null,
    cleanWater: d.cleanbot?.rising ?? 0,
    dirtyWater: d.cleanbot?.sewage ?? 0,
    shopName: d.shop?.name ?? null,
  };
}

export async function getPuduTaskList(sn: string): Promise<PuduTask[]> {
  const data = await puduFetch(`/cleanbot-service/v1/api/open/task/list?sn=${encodeURIComponent(sn)}`);
  const items = data.data || [];
  // Filter out deleted tasks (status === -1)
  return items
    .filter((t: any) => t.status === 1)
    .map((t: any) => ({
      task_id: t.task_id,
      version: t.version,
      name: t.name,
      desc: t.desc || '',
      mode: t.config?.mode ?? 0,
    }));
}

export async function sendPuduCommand(
  sn: string,
  type: number,
  clean?: Record<string, any>
): Promise<string> {
  const body: any = { sn, type };
  if (clean) body.clean = clean;

  const data = await puduFetch('/cleanbot-service/v1/api/open/task/exec', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return data.data?.task_id || data.message || 'ok';
}
