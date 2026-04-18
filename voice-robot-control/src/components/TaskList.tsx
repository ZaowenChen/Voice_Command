import type { MapInfo } from '../types';

interface Props {
  currentMap: MapInfo | null;
  emptyNote?: string;
}

export function TaskList({ currentMap, emptyNote }: Props) {
  const tasks = currentMap?.tasks || [];

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">Available Tasks</h3>
      {tasks.length === 0 ? (
        <p className="text-gray-500 text-xs leading-relaxed">
          {emptyNote || 'No tasks available'}
        </p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t, i) => (
            <li
              key={t.id || i}
              className="flex items-center gap-2 text-sm bg-gray-800 rounded px-3 py-1.5 hover:bg-gray-750"
            >
              <span className="text-blue-400">&#9654;</span>
              <span className="text-gray-200">{t.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
