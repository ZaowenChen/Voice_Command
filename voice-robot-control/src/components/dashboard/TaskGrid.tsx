import type { MapInfo } from '../../types';

interface Props {
  currentMap: MapInfo | null;
  onAgentCommand: (command: string) => void;
}

export function TaskGrid({ currentMap, onAgentCommand }: Props) {
  const tasks = currentMap?.tasks || [];
  const positions = currentMap?.positions || [];

  if (tasks.length === 0 && positions.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="bg-gray-850 rounded-2xl border border-gray-700 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Available Tasks</h3>
          <div className="grid grid-cols-1 gap-2">
            {tasks.map((t, i) => (
              <button
                key={t.id || i}
                className="flex items-center gap-3 text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-blue-600/30 rounded-xl px-4 py-3 transition-all group"
                onClick={() => onAgentCommand(`Start task "${t.name}"`)}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-200 group-hover:text-white transition-colors">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Points */}
      {positions.length > 0 && (
        <div className="bg-gray-850 rounded-2xl border border-gray-700 p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Navigation Points</h3>
          <div className="grid grid-cols-1 gap-2">
            {positions.map((p, i) => (
              <button
                key={i}
                className="flex items-center gap-3 text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-green-600/30 rounded-xl px-4 py-3 transition-all group"
                onClick={() => onAgentCommand(`Navigate to "${p.name}"`)}
              >
                <div className="w-8 h-8 rounded-lg bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-200 group-hover:text-white transition-colors">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
