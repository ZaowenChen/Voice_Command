import { useState } from 'react';
import type { Robot, RobotStatus, MapInfo } from '../types';
import { RobotSelector } from './RobotSelector';
import { RobotStatusPanel } from './RobotStatusPanel';
import { TaskList } from './TaskList';
import { NavigationPoints } from './NavigationPoints';

interface Props {
  robots: Robot[];
  selectedSN: string | null;
  onSelectRobot: (sn: string) => void;
  robotsLoading: boolean;
  status: RobotStatus | null;
  statusLoading: boolean;
  currentMap: MapInfo | null;
  ttsEnabled: boolean;
  onToggleTTS: () => void;
  onNewChat: () => void;
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
}

export function Sidebar({
  robots,
  selectedSN,
  onSelectRobot,
  robotsLoading,
  status,
  statusLoading,
  currentMap,
  ttsEnabled,
  onToggleTTS,
  onNewChat,
  isSidebarOpen,
  onCloseSidebar,
}: Props) {
  const [showDetails, setShowDetails] = useState(true);

  return (
    <>
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onCloseSidebar}
        />
      )}

      <aside
        className={`fixed lg:static z-50 h-full w-72 bg-gray-900 border-r border-gray-700 flex flex-col transition-transform duration-200 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <span>VoBotiq</span>
          </h1>
          <button
            className="lg:hidden text-gray-400 hover:text-white"
            onClick={onCloseSidebar}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <RobotSelector
            robots={robots}
            selectedSN={selectedSN}
            onSelect={onSelectRobot}
            loading={robotsLoading}
          />

          {selectedSN && (
            <>
              <RobotStatusPanel status={status} loading={statusLoading} modelTypeCode={robots.find(r => r.serialNumber === selectedSN)?.modelTypeCode} />

              {status && !status.localized && (
                <div className="bg-red-900/60 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-xs flex items-center gap-1">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Not localized
                </div>
              )}

              <button
                className="w-full text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                onClick={() => setShowDetails(!showDetails)}
              >
                <svg
                  className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Tasks & Positions
              </button>

              {showDetails && (
                <div className="space-y-3">
                  <TaskList currentMap={currentMap} />
                  <NavigationPoints currentMap={currentMap} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer controls */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          {/* TTS toggle */}
          <button
            className="w-full flex items-center justify-between text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800"
            onClick={onToggleTTS}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.8l4.7-3.5a.5.5 0 01.8.4v12.6a.5.5 0 01-.8.4L6.5 15.2H4a1 1 0 01-1-1v-4.4a1 1 0 011-1h2.5z" />
              </svg>
              Voice Replies
            </span>
            <span
              className={`w-8 h-5 rounded-full transition-colors flex items-center ${
                ttsEnabled ? 'bg-blue-600 justify-end' : 'bg-gray-600 justify-start'
              }`}
            >
              <span className="w-4 h-4 bg-white rounded-full mx-0.5" />
            </span>
          </button>

          {/* New Chat */}
          <button
            className="w-full flex items-center gap-2 text-sm text-gray-300 hover:text-white px-2 py-1.5 rounded hover:bg-gray-800"
            onClick={onNewChat}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>
      </aside>
    </>
  );
}
