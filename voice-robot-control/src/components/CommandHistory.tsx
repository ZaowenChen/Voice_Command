import type { CommandHistoryEntry } from '../types';

interface Props {
  history: CommandHistoryEntry[];
}

export function CommandHistory({ history }: Props) {
  if (history.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2">History</h3>
        <p className="text-gray-600 text-xs">No commands yet</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-400 mb-2">History</h3>
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {[...history].reverse().map((entry) => {
          const time = new Date(entry.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const intent = entry.command.intent.replace(/_/g, ' ');
          const icon = entry.result === 'success' ? '\u2705' : entry.result === 'error' ? '\u274C' : '\u23F3';

          return (
            <li
              key={entry.id}
              className="flex items-center gap-3 text-xs bg-gray-800/50 rounded px-3 py-2"
            >
              <span className="text-gray-500 font-mono">{time}</span>
              <span className="text-gray-300 flex-1 capitalize">{intent}</span>
              <span>{icon}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
