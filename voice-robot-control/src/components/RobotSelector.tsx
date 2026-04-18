import type { Robot } from '../types';
import { manufacturerLabel } from '../utils/robotCategory';

interface Props {
  robots: Robot[];
  selectedSN: string | null;
  onSelect: (sn: string) => void;
  loading: boolean;
}

export function RobotSelector({ robots, selectedSN, onSelect, loading }: Props) {
  const selectedRobot = robots.find((r) => r.serialNumber === selectedSN);
  const selectedBadge = manufacturerLabel(selectedRobot?.robotType);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-400 mb-1">Select Robot</label>
      <select
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={selectedSN || ''}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
      >
        <option value="">-- Choose a robot --</option>
        {robots.map((r) => {
          const badge = manufacturerLabel(r.robotType);
          const prefix = badge ? `[${badge}] ` : '';
          return (
            <option key={r.serialNumber} value={r.serialNumber} disabled={!r.online}>
              {prefix}
              {r.displayName} ({r.modelTypeCode}) {r.online ? '' : '- Offline'}
            </option>
          );
        })}
      </select>
      {selectedBadge && (
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gray-800 border border-gray-700 px-2 py-1 text-xs text-gray-300">
          <span
            className={`w-2 h-2 rounded-full ${
              selectedRobot?.robotType === 'pudu' ? 'bg-amber-400' : 'bg-sky-400'
            }`}
          />
          {selectedBadge}
        </div>
      )}
    </div>
  );
}
