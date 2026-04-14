import type { RobotStatus } from '../types';
import { isScrubber } from '../utils/robotCategory';

interface Props {
  status: RobotStatus | null;
  loading: boolean;
  modelTypeCode?: string;
}

export function RobotStatusPanel({ status, loading, modelTypeCode }: Props) {
  if (loading && !status) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (!status) {
    return <p className="text-gray-500 text-sm">Select a robot to see its status</p>;
  }

  const batteryColor =
    status.battery > 50 ? 'text-green-400' : status.battery > 20 ? 'text-yellow-400' : 'text-red-400';

  const taskStateColors: Record<string, string> = {
    idle: 'text-gray-400',
    running: 'text-green-400',
    paused: 'text-yellow-400',
    error: 'text-red-400',
  };

  const showWater = modelTypeCode && isScrubber(modelTypeCode) && status.cleanWater != null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400">Robot Status</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Battery:</span>
          <span className={batteryColor}>{status.battery}%</span>
          <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[80px]">
            <div
              className={`h-2 rounded-full ${
                status.battery > 50 ? 'bg-green-500' : status.battery > 20 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${status.battery}%` }}
            />
          </div>
        </div>
        <div>
          <span className="text-gray-500">Map: </span>
          <span className="text-white">{status.currentMap || 'None'}</span>
        </div>
        <div>
          <span className="text-gray-500">Status: </span>
          <span className={taskStateColors[status.taskState] || 'text-gray-400'}>
            {status.taskState.charAt(0).toUpperCase() + status.taskState.slice(1)}
          </span>
        </div>
        <div>
          <span className="text-gray-500">Task: </span>
          <span className="text-white">{status.currentTask || 'None'}</span>
        </div>

        {showWater && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Clean water:</span>
              <span className="text-blue-400">{status.cleanWater ?? 0}%</span>
              <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[80px]">
                <div
                  className="h-2 rounded-full bg-blue-500"
                  style={{ width: `${status.cleanWater ?? 0}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Dirty water:</span>
              <span className="text-amber-600">{status.dirtyWater ?? 0}%</span>
              <div className="flex-1 bg-gray-700 rounded-full h-2 max-w-[80px]">
                <div
                  className="h-2 rounded-full bg-amber-700"
                  style={{ width: `${status.dirtyWater ?? 0}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
