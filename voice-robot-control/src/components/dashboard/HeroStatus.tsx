import type { RobotStatus, Robot } from '../../types';

interface Props {
  robot: Robot | null;
  status: RobotStatus | null;
  loading: boolean;
}

export function HeroStatus({ robot, status, loading }: Props) {
  if (!robot) {
    return (
      <div className="bg-gray-850 rounded-2xl border border-gray-700 p-8 text-center">
        <img src="/cobotiq-logo.png" alt="Cobotiq" className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <h2 className="text-xl text-gray-400 font-medium">Fleet Management Overview</h2>
        <p className="text-sm text-gray-600 mt-2">Select a robot above to begin monitoring</p>
      </div>
    );
  }

  if (loading && !status) {
    return (
      <div className="bg-gray-850 rounded-2xl border border-gray-700 p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-3" />
        <div className="h-10 bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  const taskState = status?.taskState || 'idle';
  const isRunning = taskState === 'running';
  const isPaused = taskState === 'paused';
  const isError = taskState === 'error';

  const statusConfig = {
    running: { label: `Active: ${status?.currentTask || 'Cleaning'}`, color: 'from-green-900/40 to-green-900/10', border: 'border-green-700/50', badge: 'bg-green-600', dot: 'bg-green-400' },
    paused: { label: `Paused: ${status?.currentTask || 'Task'}`, color: 'from-yellow-900/40 to-yellow-900/10', border: 'border-yellow-700/50', badge: 'bg-yellow-600', dot: 'bg-yellow-400' },
    error: { label: 'Error', color: 'from-red-900/40 to-red-900/10', border: 'border-red-700/50', badge: 'bg-red-600', dot: 'bg-red-400' },
    idle: { label: 'Idle', color: 'from-gray-800/40 to-gray-800/10', border: 'border-gray-700', badge: 'bg-gray-600', dot: 'bg-gray-400' },
  };

  const cfg = statusConfig[taskState] || statusConfig.idle;

  return (
    <div className={`bg-gradient-to-r ${cfg.color} rounded-2xl border ${cfg.border} p-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{robot.modelTypeCode}</p>
          <h2 className="text-2xl font-bold text-white">{robot.displayName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${cfg.dot} ${isRunning ? 'animate-pulse' : ''}`} />
          <span className={`${cfg.badge} text-white text-sm font-medium px-3 py-1 rounded-full`}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Localization warning */}
      {status && !status.localized && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm bg-red-900/30 rounded-lg px-3 py-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Robot not localized &mdash; commands may fail
        </div>
      )}
    </div>
  );
}
