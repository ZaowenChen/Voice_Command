import type { Robot } from '../types';

interface Props {
  robots: Robot[];
  selectedSN: string | null;
  onSelect: (sn: string) => void;
  loading: boolean;
}

export function RobotSelector({ robots, selectedSN, onSelect, loading }: Props) {
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
        {robots.map((r) => (
          <option key={r.serialNumber} value={r.serialNumber} disabled={!r.online}>
            {r.displayName} ({r.modelTypeCode}) {r.online ? '' : '- Offline'}
          </option>
        ))}
      </select>
    </div>
  );
}
