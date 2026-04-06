import type { RobotStatus } from '../../types';

interface Props {
  status: RobotStatus | null;
  online: boolean;
}

export function VitalsPanel({ status, online }: Props) {
  const battery = status?.battery ?? 0;
  const batteryColor =
    battery > 50 ? 'text-green-400' : battery > 20 ? 'text-yellow-400' : 'text-red-400';
  const batteryBarColor =
    battery > 50 ? 'bg-green-500' : battery > 20 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-gray-850 rounded-2xl border border-gray-700 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Vital Stats</h3>
      <div className="space-y-4">
        {/* Battery */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className={`w-5 h-5 ${batteryColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-sm text-gray-400">Battery</span>
          </div>
          <span className={`text-lg font-bold ${batteryColor}`}>{battery}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className={`h-2 rounded-full ${batteryBarColor} transition-all duration-500`} style={{ width: `${battery}%` }} />
        </div>

        {/* Current Map */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm text-gray-400">Map</span>
          </div>
          <span className="text-sm font-medium text-white">{status?.currentMap || 'None'}</span>
        </div>

        {/* Network */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
            </svg>
            <span className="text-sm text-gray-400">Network</span>
          </div>
          <span className={`text-sm font-medium flex items-center gap-1.5 ${online ? 'text-green-400' : 'text-red-400'}`}>
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-red-400'}`} />
            {online ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
