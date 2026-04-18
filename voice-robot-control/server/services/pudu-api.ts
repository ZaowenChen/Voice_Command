import crypto from 'crypto';

const BASE = process.env.PUDU_BASE_URL || 'https://csu-open-platform.pudutech.com';
const PATH_PREFIX = '/pudu-entry';

// Default task/list `mode` filter. The Pudu gateway defaults to `[2]` (auto
// tasks only) when the param is omitted, which silently hides manual (1) and
// inspection/hybrid (3) tasks. We include all three unless a caller overrides.
const DEFAULT_TASK_LIST_MODES = [1, 2, 3];

export function hasPuduCredentials(): boolean {
  return !!(process.env.PUDU_API_KEY && process.env.PUDU_APP_SECRET);
}

// ── HMAC-SHA1 Signature Auth ──

function puduCanonical(path: string, query: string): string {
  if (!path.startsWith('/')) path = '/' + path;
  if (!query) return path || '/';

  // Aliyun API Gateway canonicalisation (per §1.1 + Aliyun HMAC spec):
  //   • Group parameters by key.
  //   • Sort keys lexicographically.
  //   • Within a repeated key, sort values lexicographically and join with
  //     a comma (NOT repeated `k=v1&k=v2` — that fails HMAC verification).
  //   • Empty-value parameter: emit only the key, no `=`.
  //   • Decode URL-encoded values before signing.
  //
  // IMPORTANT: the wire request keeps the repeated `k=v1&k=v2` form (which
  // the backend needs to parse it as Array<T>). Only the canonical signing
  // string uses the comma-joined form.
  const grouped = new Map<string, string[]>();
  for (const pair of query.split('&').filter(Boolean)) {
    const eq = pair.indexOf('=');
    const key = eq >= 0 ? pair.slice(0, eq) : pair;
    const rawVal = eq >= 0 ? pair.slice(eq + 1) : null;
    if (!grouped.has(key)) grouped.set(key, []);
    if (rawVal !== null) {
      try {
        grouped.get(key)!.push(decodeURIComponent(rawVal));
      } catch {
        grouped.get(key)!.push(rawVal);
      }
    }
  }

  const keys = Array.from(grouped.keys()).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const vals = grouped.get(key)!;
    if (vals.length === 0) {
      parts.push(key);
    } else {
      vals.sort();
      parts.push(`${key}=${vals.join(',')}`);
    }
  }

  return path + '?' + parts.join('&');
}

function getPuduHeaders(
  method: string,
  fullUrl: string,
  body?: string
): Record<string, string> {
  const appKey = process.env.PUDU_API_KEY!;
  const appSecret = process.env.PUDU_APP_SECRET!;
  const url = new URL(fullUrl);
  const canonical = puduCanonical(url.pathname, url.search.replace(/^\?/, ''));
  const xDate = new Date().toUTCString();

  // Per §1.1, Content-MD5 is a signed field and is required when the request
  // carries a non-form body. Sign the same bytes that go on the wire.
  const contentMd5 = body
    ? crypto.createHash('md5').update(body, 'utf8').digest('base64')
    : '';

  const signStr =
    `x-date: ${xDate}\n` +
    `${method.toUpperCase()}\n` +
    'application/json\n' +
    'application/json\n' +
    `${contentMd5}\n` +
    canonical;

  const sig = crypto
    .createHmac('sha1', appSecret)
    .update(signStr)
    .digest('base64');

  const headers: Record<string, string> = {
    Host: url.host,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'x-date': xDate,
    Authorization: `hmac id="${appKey}", algorithm="hmac-sha1", headers="x-date", signature="${sig}"`,
  };
  if (contentMd5) headers['Content-MD5'] = contentMd5;
  return headers;
}

async function puduFetch(path: string, options: RequestInit = {}) {
  if (!process.env.PUDU_API_KEY || !process.env.PUDU_APP_SECRET) {
    throw new Error('Pudu API credentials not configured');
  }

  const method = options.method || 'GET';
  const fullUrl = `${BASE}${PATH_PREFIX}${path}`;
  const bodyStr =
    typeof options.body === 'string' ? options.body : undefined;
  const headers = getPuduHeaders(method, fullUrl, bodyStr);

  const res = await fetch(fullUrl, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
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
  /** Map level identifier from Pudu (stable numeric id for a floor/map). */
  mapLv: number | null;
  taskState: 'idle' | 'running' | 'paused' | 'error';
  currentTask: string | null;
  /** Task id of the running cleaning session, if any. Surfaced so downstream
   * pause/cancel flows don't need a second task/list roundtrip. */
  currentTaskId: string | null;
  /** Task version of the running cleaning session, if any. */
  currentTaskVersion: number | null;
  /** Report id of the active cleaning session (useful for log lookups). */
  currentReportId: string | null;
  cleanWater: number;
  dirtyWater: number;
  shopName: string | null;
  shopId: number | null;
  /** Raw robot activity code from `cleanbot.task` (§1.5). `-200` = LostLocation,
   * `-100` = Error, 100..760 = active sub-states. `null` when the field is
   * absent (robot is Normal/idle — the spec leaves `task` unset for Normal). */
  robotActivityCode: number | null;
  /** False when `cleanbot.task === -200` (LostLocation, §1.5). Note: subtle
   * transient delocalization is only pushed via the `robotErrorNotice`
   * webhook and won't set this false. */
  localized: boolean;
}

export interface PuduTask {
  task_id: string;
  version: number;
  name: string;
  desc: string;
  mode: number; // 1=mop, 2=sweep
  /** Map name this task is defined on (first entry in floor_list). Used to
   * disambiguate duplicate task names and to show which map a task runs on. */
  mapName: string | null;
  /** Floor string from the task's floor_list entry (e.g. "1", "3"). */
  floor: string | null;
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

/**
 * GET /open-platform-service/v2/status/get_by_sn — V2 status endpoint.
 * Returns `product_code` (the robot model, e.g. `CC1`, `CC1Pro`, `MT1`,
 * `MT1Vac`, `MT1Max`, `PuduT300`, etc.; see §1.6), plus `run_state`
 * (`OFFLINE`/`DISABLE`/`BUSY`/`IDLE`), battery, move_state, charge_stage.
 *
 * `robot/detail` (cleanbot-service) does NOT expose the model — use this
 * to learn what kind of robot you're talking to.
 */
export async function getPuduRobotStatusV2(sn: string): Promise<{
  sn?: string;
  mac?: string;
  battery?: number;
  product_code?: string;
  run_state?: 'OFFLINE' | 'DISABLE' | 'BUSY' | 'IDLE';
  move_state?: string;
  charge_stage?: string;
  is_charging?: number;
  [k: string]: unknown;
}> {
  const data = await puduFetch(
    `/open-platform-service/v2/status/get_by_sn?sn=${encodeURIComponent(sn)}`
  );
  return data.data || data;
}

/**
 * Raw, unfiltered robot/detail response. For debugging only.
 */
export async function getPuduRobotDetailRaw(sn: string): Promise<any> {
  return puduFetch(`/cleanbot-service/v1/api/open/robot/detail?sn=${encodeURIComponent(sn)}`);
}

/**
 * Raw, unfiltered task/list response. For debugging only. Passes all three
 * `mode` values explicitly — the gateway default is `[2]` (auto only) and
 * would silently hide manual (1) / inspection (3) tasks, making the raw
 * dump look short when the robot actually has more.
 */
export async function getPuduTaskListRaw(sn: string): Promise<any> {
  // Wire: repeated `mode=1&mode=2&mode=3` so the backend parses as Array<int>.
  // Signing canonicalises these to `mode=1,2,3` — see puduCanonical().
  const modeQs = DEFAULT_TASK_LIST_MODES.map((m) => `mode=${m}`).join('&');
  return puduFetch(
    `/cleanbot-service/v1/api/open/task/list?sn=${encodeURIComponent(sn)}&${modeQs}`
  );
}

/**
 * GET /map-service/v1/open/list — maps the robot currently knows about.
 * Useful for comparing against the map names returned in task floor_list
 * entries when tasks appear "missing" from a given map.
 */
export async function getPuduAvailableMaps(
  sn: string
): Promise<Array<{ name: string; floor: string }>> {
  const data = await puduFetch(
    `/map-service/v1/open/list?sn=${encodeURIComponent(sn)}`
  );
  return data.data?.list || [];
}

/**
 * GET /map-service/v1/open/current — the robot's authoritative current map
 * (the `/robot/detail` map can lag or be stale, especially across re-localize).
 */
export async function getPuduCurrentMap(
  sn: string
): Promise<{ name: string; floor: string } | null> {
  const data = await puduFetch(
    `/map-service/v1/open/current?sn=${encodeURIComponent(sn)}`
  );
  return data.data || null;
}

export async function getPuduRobotStatus(sn: string): Promise<PuduRobotStatus> {
  const data = await puduFetch(`/cleanbot-service/v1/api/open/robot/detail?sn=${encodeURIComponent(sn)}`);
  const d = data.data || data;

  // `cleanbot.clean.result.status` is the session-result code (0..6). It is
  // the closest polling-based signal we have for whether a cleaning task is
  // currently running, paused, or in error. Robot-level run-state (IDLE/BUSY)
  // is only reliably available via the notifyRobotStatus webhook.
  const cleanStatus = d.cleanbot?.clean?.result?.status ?? null;

  // Per §4.2 of the Pudu API reference, the running task's identifying fields
  // live under `cleanbot.clean.task` (task_id / version / name), NOT directly
  // on `cleanbot.clean`.
  const cleanTask = d.cleanbot?.clean?.task ?? null;

  // §1.5: `cleanbot.task` is the robot activity code. `-200` = LostLocation,
  // `-100` = Error, 100..760 = active sub-states. The field is absent when
  // the robot is Normal (idle). We expose both the raw code and a derived
  // `localized` flag so callers can detect delocalization via polling.
  const activityCode =
    typeof d.cleanbot?.task === 'number' ? d.cleanbot.task : null;

  return {
    serialNumber: sn,
    nickname: d.nickname || sn,
    online: d.online ?? false,
    battery: d.battery ?? 0,
    mapName: d.map?.name ?? null,
    mapLv: typeof d.map?.lv === 'number' ? d.map.lv : null,
    taskState: mapPuduCleanStatus(cleanStatus),
    currentTask: cleanTask?.name ?? null,
    // Per §3.3 `task_id` is declared `long` and per §9 it must be treated as a
    // string everywhere. Coerce whatever the server sent (number or string) so
    // we don't lose large ids to a `typeof === 'string'` guard.
    currentTaskId:
      cleanTask?.task_id != null ? String(cleanTask.task_id) : null,
    currentTaskVersion:
      typeof cleanTask?.version === 'number' ? cleanTask.version : null,
    currentReportId:
      typeof d.cleanbot?.clean?.report_id === 'string'
        ? d.cleanbot.clean.report_id
        : null,
    cleanWater: d.cleanbot?.rising ?? 0,
    dirtyWater: d.cleanbot?.sewage ?? 0,
    shopName: d.shop?.name ?? null,
    shopId: typeof d.shop?.id === 'number' ? d.shop.id : null,
    robotActivityCode: activityCode,
    localized: activityCode !== -200,
  };
}

export async function getPuduTaskList(
  sn: string,
  filter?: { mapName?: string | null; mapLv?: number | null } | string | null
): Promise<PuduTask[]> {
  // Accept legacy (string mapName) or new ({ mapName, mapLv }) filter forms.
  // NOTE: mapLv is accepted for backward-compat but no longer used — Pudu's
  // `lv` field is a map revision counter, not a stable map id, so matching
  // on it produces false positives.
  const filterMapName =
    typeof filter === 'string' ? filter : filter?.mapName ?? null;

  // Always pass `mode` explicitly — the gateway default is `[2]` (auto only),
  // which silently hides manual (1) and inspection/hybrid (3) tasks. Wire
  // format is repeated `mode=1&mode=2&mode=3` (so the backend parses as
  // Array<int>); the signing string canonicalises these to `mode=1,2,3`
  // per Aliyun HMAC rules — see puduCanonical().
  const modeQs = DEFAULT_TASK_LIST_MODES.map((m) => `mode=${m}`).join('&');
  const data = await puduFetch(
    `/cleanbot-service/v1/api/open/task/list?sn=${encodeURIComponent(sn)}&${modeQs}`
  );
  const items: any[] = data.data?.item || data.data || [];

  const toPuduTask = (t: any): PuduTask => {
    const firstFloor = Array.isArray(t.floor_list) ? t.floor_list[0] : null;
    return {
      task_id: t.task_id,
      version: t.version || 0,
      name: t.name || t.task_name || `Task ${t.task_id}`,
      desc: t.desc || '',
      mode: t.config?.mode ?? 0,
      mapName: firstFloor?.map?.name ?? null,
      floor: firstFloor?.map?.floor ?? null,
    };
  };

  // Pudu map names follow `floor#id#descriptive` (§9). Parse the pieces so
  // we can fall back to a softer match when the embedded id changes (which
  // happens whenever a map is re-saved).
  const parseMapName = (name: string | null | undefined) => {
    if (!name) return null;
    const parts = name.split('#');
    return {
      raw: name,
      floor: parts[0] ?? null,
      id: parts[1] ?? null,
      descriptive: parts.length >= 3 ? parts.slice(2).join('#') : name,
    };
  };
  const filterParsed = parseMapName(filterMapName);

  // Always drop deleted tasks.
  const active = items.filter((t: any) => t.status !== -1);

  // A Pudu task can span multiple floors/maps (floor_list is an array).
  // Match tiers (first hit wins):
  //   1. exact map.name (authoritative, §9 format)
  //   2. same floor + same descriptive name (handles re-saved maps whose
  //      embedded id bumped but floor + visible name are unchanged)
  const exactOnMap = filterMapName
    ? active.filter((t: any) => {
        const floors: any[] = Array.isArray(t.floor_list) ? t.floor_list : [];
        return floors.some((f) => f?.map?.name === filterMapName);
      })
    : active;

  const softOnMap = filterParsed && exactOnMap.length === 0
    ? active.filter((t: any) => {
        const floors: any[] = Array.isArray(t.floor_list) ? t.floor_list : [];
        return floors.some((f) => {
          const parsed = parseMapName(f?.map?.name);
          if (!parsed) return false;
          return (
            parsed.floor === filterParsed.floor &&
            parsed.descriptive === filterParsed.descriptive
          );
        });
      })
    : [];

  // When a filter was requested, scope strictly to it — do NOT fall back to
  // returning every task in the shop. That fallback was leaking every task
  // across every robot/map and made it look like the filter was ignored.
  // Empty result is honest: it tells the user the robot's current map has
  // no defined tasks (usually because it's not localized on a mapped area).
  const onCurrentMap = exactOnMap.length > 0 ? exactOnMap : softOnMap;
  const result = filterMapName ? onCurrentMap : active;
  const matchKind = !filterMapName
    ? 'no-filter'
    : exactOnMap.length > 0
      ? 'exact'
      : softOnMap.length > 0
        ? 'soft(floor+descriptive)'
        : 'none';

  console.log(
    `[pudu] task/list sn=${sn} total=${items.length} active=${active.length} ` +
      `match=${matchKind} returned=${result.length} ` +
      `filter=${JSON.stringify({ mapName: filterMapName })}`
  );

  // Diagnostic: dump every task's name + its floor_list maps so we can see
  // what the filter is actually comparing against. Set PUDU_DEBUG_TASKS=0
  // in .env to silence.
  if (process.env.PUDU_DEBUG_TASKS !== '0') {
    for (const t of items) {
      const floors = Array.isArray(t.floor_list) ? t.floor_list : [];
      const maps = floors.map((f: any) => ({
        name: f?.map?.name ?? null,
        lv: f?.map?.lv ?? null,
        floor: f?.map?.floor ?? null,
      }));
      console.log(
        `[pudu]   task "${t.name || t.task_name || t.task_id}" status=${t.status} ` +
          `maps=${JSON.stringify(maps)}`
      );
    }
  }

  return result.map(toPuduTask);
}

export async function sendPuduCommand(
  sn: string,
  type: number,
  clean?: Record<string, any>
): Promise<string> {
  const body: any = {
    trace_id: crypto.randomUUID(),
    sn,
    type,
  };
  if (clean) body.clean = clean;

  const data = await puduFetch('/cleanbot-service/v1/api/open/task/exec', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return data.data?.task_id || data.message || 'ok';
}

// ── Analytics (cleaning summary + reports) ──
//
// Pudu's analytics/log endpoints live under `/data-board/v1/...` and are
// GET-with-query-string, NOT POST. They are scopable by `shop_id` only —
// there is no per-robot `sn_list` filter at this layer. See §7, §8 of the
// Pudu API reference.
//
// Freshness caveats:
//   • Analytics (`/analysis/clean/summary`) — up to ~1 hour delay
//   • Logs      (`/log/clean_task/query_list`) — up to ~10 minutes delay,
//                                                 max 180-day lookback

function buildQueryString(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}

export interface PuduCleaningSummaryParams {
  /** Inclusive start timestamp — unix seconds. Required. */
  start_time: number;
  /** Inclusive end timestamp — unix seconds. Required. */
  end_time: number;
  /** Store id filter. Pudu analytics scope to stores, not individual robots. */
  shop_id?: number;
  /** 0=all, 1=mopping, 2=sweeping. Defaults to 0 (all). */
  clean_mode?: 0 | 1 | 2;
  /** Sub-mode filter (see §11 of the API reference). */
  sub_mode?: number;
  /** Timezone offset in hours, -12..+14. Defaults to 0 (UTC). */
  timezone_offset?: number;
}

/**
 * GET /data-board/v1/analysis/clean/mode
 * Returns aggregated cleaning totals (area, duration, task_count,
 * power_consumption, water_consumption) with period-over-period comparison
 * (`summary` + `qoq`) plus time-series `chart[]`/`qoq_chart[]`. There is no
 * `/analysis/clean/summary` endpoint — this is the spec-correct replacement.
 * `clean_mode` is required by the gateway; we default to 0 (all) when omitted.
 */
export async function getPuduCleaningSummary(
  params: PuduCleaningSummaryParams
): Promise<any> {
  const qs = buildQueryString({
    start_time: params.start_time,
    end_time: params.end_time,
    shop_id: params.shop_id,
    clean_mode: params.clean_mode ?? 0,
    sub_mode: params.sub_mode,
    timezone_offset: params.timezone_offset,
  });
  return puduFetch(`/data-board/v1/analysis/clean/mode?${qs}`);
}

export interface PuduCleaningReportParams {
  /** Inclusive start timestamp — unix seconds. Required. */
  start_time: number;
  /** Inclusive end timestamp — unix seconds. Required. */
  end_time: number;
  /** Store id filter (no per-robot scoping at this endpoint). */
  shop_id?: number;
  /** Pagination offset. Defaults to 0. */
  offset?: number;
  /** Items per page, 1..20. Defaults to 10. */
  limit?: number;
  /** Timezone offset in hours. */
  timezone_offset?: number;
}

/**
 * GET /data-board/v1/log/clean_task/query_list
 * Returns a paginated list of individual cleaning session reports. Historical
 * lookback is capped at 180 days; data lags ~10 minutes behind the robot.
 */
export async function getPuduCleaningReports(
  params: PuduCleaningReportParams
): Promise<any> {
  const offset = typeof params.offset === 'number' ? Math.max(0, params.offset) : 0;
  const rawLimit = typeof params.limit === 'number' ? params.limit : 10;
  const limit = Math.max(1, Math.min(20, rawLimit));
  const qs = buildQueryString({
    start_time: params.start_time,
    end_time: params.end_time,
    shop_id: params.shop_id,
    offset,
    limit,
    timezone_offset: params.timezone_offset,
  });
  return puduFetch(`/data-board/v1/log/clean_task/query_list?${qs}`);
}
