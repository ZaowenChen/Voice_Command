import type { Robot } from '../../types';

interface Props {
  robots: Robot[];
  selectedSN: string | null;
  onSelectRobot: (sn: string) => void;
  loading: boolean;
}

export function TopNav({ robots, selectedSN, onSelectRobot, loading }: Props) {
  return (
    <nav className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img src="/cobotiq-brand.png" alt="Cobotiq" className="h-7 invert" />
        </div>

        {/* Robot Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 hidden sm:block">ACTIVE ROBOT</span>
          <select
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            value={selectedSN || ''}
            onChange={(e) => onSelectRobot(e.target.value)}
            disabled={loading}
          >
            <option value="">-- Select Robot --</option>
            {robots.map((r) => (
              <option key={r.serialNumber} value={r.serialNumber} disabled={!r.online}>
                {r.displayName} ({r.modelTypeCode}){r.online ? '' : ' - Offline'}
              </option>
            ))}
          </select>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${selectedSN ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-xs text-gray-500 hidden sm:block">
            {selectedSN ? 'Connected' : 'No Robot'}
          </span>
        </div>
      </div>
    </nav>
  );
}
