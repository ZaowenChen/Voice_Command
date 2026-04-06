import type { MapInfo } from '../types';

interface Props {
  currentMap: MapInfo | null;
}

export function NavigationPoints({ currentMap }: Props) {
  const positions = currentMap?.positions || [];

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">Navigation Points</h3>
      {positions.length === 0 ? (
        <p className="text-gray-600 text-xs">No positions available</p>
      ) : (
        <ul className="space-y-1">
          {positions.map((p, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-sm bg-gray-800 rounded px-3 py-1.5 hover:bg-gray-750"
            >
              <span className="text-green-400">&#128205;</span>
              <span className="text-gray-200">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
