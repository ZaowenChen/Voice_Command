import { useState, useEffect, useRef } from 'react';
import type { RobotStatus, SiteInfo, MapInfo } from '../types';
import { fetchRobotStatus, fetchSiteInfo } from '../services/api';

export function useRobotStatus(serialNumber: string | null) {
  const [status, setStatus] = useState<RobotStatus | null>(null);
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [currentMap, setCurrentMap] = useState<MapInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!serialNumber) {
      setStatus(null);
      setSiteInfo(null);
      setCurrentMap(null);
      return;
    }

    async function poll() {
      try {
        setLoading(true);
        const [s, site] = await Promise.all([
          fetchRobotStatus(serialNumber!),
          fetchSiteInfo(serialNumber!),
        ]);
        setStatus(s);
        setSiteInfo(site);

        // Find current map from site info
        if (site?.buildings) {
          for (const b of site.buildings) {
            for (const f of b.floors) {
              for (const m of f.maps) {
                if (m.id === s.currentMapId || m.name === s.currentMap) {
                  setCurrentMap(m);
                  break;
                }
              }
            }
          }
          // If no match, use first map as default
          if (!currentMap && site.buildings[0]?.floors[0]?.maps[0]) {
            setCurrentMap(site.buildings[0].floors[0].maps[0]);
          }
        }
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 10_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [serialNumber]);

  return { status, siteInfo, currentMap, loading, error };
}
