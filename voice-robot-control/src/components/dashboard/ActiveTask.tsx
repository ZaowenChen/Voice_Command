import type { RobotStatus } from '../../types';

interface Props {
  status: RobotStatus | null;
  onAgentCommand: (command: string) => void;
}

export function ActiveTask({ status, onAgentCommand }: Props) {
  const hasTask = status?.currentTask;
  const taskState = status?.taskState || 'idle';
  const isRunning = taskState === 'running';
  const isPaused = taskState === 'paused';

  return (
    <div className="bg-gray-850 rounded-2xl border border-gray-700 p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Current Task</h3>

      {hasTask ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium">{status.currentTask}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                isRunning
                  ? 'bg-green-900/50 text-green-400 border border-green-700/50'
                  : isPaused
                  ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {taskState.charAt(0).toUpperCase() + taskState.slice(1)}
            </span>
          </div>

          {/* Progress placeholder */}
          {isRunning && (
            <div className="space-y-1">
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-blue-500 animate-progress" style={{ width: '60%' }} />
              </div>
              <p className="text-xs text-gray-500">In progress...</p>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex gap-2 pt-1">
            {isRunning && (
              <button
                className="flex-1 text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-700/50 rounded-lg py-2 hover:bg-yellow-900/50 transition-colors"
                onClick={() => onAgentCommand('Pause the current task')}
              >
                Pause
              </button>
            )}
            {isPaused && (
              <button
                className="flex-1 text-xs bg-green-900/30 text-green-400 border border-green-700/50 rounded-lg py-2 hover:bg-green-900/50 transition-colors"
                onClick={() => onAgentCommand('Resume the current task')}
              >
                Resume
              </button>
            )}
            {(isRunning || isPaused) && (
              <button
                className="flex-1 text-xs bg-red-900/30 text-red-400 border border-red-700/50 rounded-lg py-2 hover:bg-red-900/50 transition-colors"
                onClick={() => onAgentCommand('Stop the current task')}
              >
                Stop
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <svg className="w-10 h-10 mx-auto text-gray-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm text-gray-500">No active task</p>
          <p className="text-xs text-gray-600 mt-1">Use the agent to start a task</p>
        </div>
      )}
    </div>
  );
}
