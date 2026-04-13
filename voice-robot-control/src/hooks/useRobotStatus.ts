import { useState, useEffect, useRef, useCallback } from 'react';
import type { RobotStatus, SiteInfo, MapInfo } from '../types';
import { fetchRobotStatus, fetchSiteInfo } from '../services/api';

const POLL_INTERVAL = 5_000; // 5 seconds (reduced from 10s for faster feedback)

export function useRobotStatus(serialNumber: string | null) {
  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [currentMap, setCurrentMap] = useState<MapInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serialNumberRef = useRef<string | null>(serialNumber);

  // Keep ref in sync so poll callback always has the latest value
  serialNumberRef.current = serialNumber;

  const poll = useCallback(async () => {
    const sn = serialNumberRef.current;
    if (!sn) return;

    try {
      setLoading(true);
      const [s, site] = await Promise.all([
        fetchRobotStatus(sn),
        fetchSiteInfo(sn),
      ]);
      setStatus(s);
      setSiteInfo(site);

      // Find current map from site info
      let foundMap: MapInfo | null = null;
      if (site?.buildings) {
        for (const b of site.buildings) {
          for (const f of b.floors) {
            for (const m of f.maps) {
              if (m.id === s.currentMapId || m.name === s.currentMap) {
                foundMap = m;
                break;
              }
            }
            if (foundMap) break;
          }
          if (foundMap) break;
        }
        // If no match, use first map as default
        if (!foundMap && site.buildings[0]?.floors[0]?.maps[0]) {
          foundMap = site.buildings[0].floors[0].maps[0];
        }
      }
      setCurrentMap(foundMap);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Expose a way to trigger an immediate refresh (e.g. after sending a command)
  const refreshNow = useCallback(() => {
    poll();
  }, [poll]);

  useEffect(() => {
    if (!serialNumber) {
      setStatus(null);
      setSiteInfo(null);
      setCurrentMap(null);
      return;
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [serialNumber, poll]);

  return { status, siteInfo, currentMap, loading, error, refreshNow };
}
