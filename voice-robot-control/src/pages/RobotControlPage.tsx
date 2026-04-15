import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Robot, SiteInfo, MapInfo, WorkMode } from '../types';
import { fetchRobots } from '../services/api';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useChat } from '../hooks/useChat';
import { useTTS } from '../hooks/useTTS';
import { isScrubber } from '../utils/robotCategory';
import { VoiceBar } from '../components/VoiceBar';
import { AgentOverlay } from '../components/agent/AgentOverlay';

export function RobotControlPage() {
  const { sn } = useParams<{ sn: string }>();
  const navigate = useNavigate();
  const [robot, setRobot] = useState<Robot | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [navPickerOpen, setNavPickerOpen] = useState(false);

  const { status, siteInfo, currentMap, loading } = useRobotStatus(sn || null);
  const { messages, isLoading: chatLoading, sendMessage, resetWithGreeting } = useChat(sn || null);
  const { ttsEnabled, speak, toggleTTS } = useTTS();

  // Load robot info
  useEffect(() => {
    if (!sn) return;
    fetchRobots().then((bots) => {
      const found = bots.find((r) => r.serialNumber === sn);
      if (found) setRobot(found);
    });
  }, [sn]);

  const handleOpenAgent = useCallback(() => {
    resetWithGreeting(robot?.displayName);
    setAgentOpen(true);
  }, [resetWithGreeting, robot]);

  const handleSend = useCallback(
    async (text: string, isVoice?: boolean) => {
      const reply = await sendMessage(text, isVoice);
      if (reply && ttsEnabled) speak(reply);
    },
    [sendMessage, ttsEnabled, speak]
  );

  const handleAgentCommand = useCallback(
    (command: string) => {
      if (!agentOpen) {
        resetWithGreeting(robot?.displayName);
        setAgentOpen(true);
      }
      setTimeout(() => {
        sendMessage(command).then((reply) => {
          if (reply && ttsEnabled) speak(reply);
        });
      }, 100);
    },
    [agentOpen, resetWithGreeting, robot, sendMessage, ttsEnabled, speak]
  );

  const handleVoiceMessage = useCallback(
    (transcript: string) => {
      handleAgentCommand(transcript);
    },
    [handleAgentCommand]
  );

  // Gather tasks, work modes, and nav points from site info
  const allTasks: string[] = [];
  const allWorkModes: WorkMode[] = [];
  const allPositions: Array<{ name: string }> = [];
  if (siteInfo?.buildings) {
    for (const b of siteInfo.buildings) {
      for (const f of b.floors) {
        for (const m of f.maps) {
          for (const t of m.tasks) allTasks.push(t.name);
          if (m.workModes) {
            for (const wm of m.workModes) allWorkModes.push(wm);
          }
          for (const p of m.positions) allPositions.push(p);
        }
      }
    }
  }

  const isTaskRunning = status?.taskState === 'running';
  const isTaskPaused = status?.taskState === 'paused';

  return (
    <div className="min-h-screen pb-[70px]" style={{ background: '#0F1117' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/fleet')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{robot?.displayName || sn}</h1>
            {robot && <p className="text-[11px] text-gray-500">{robot.serialNumber}</p>}
          </div>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Hero status card */}
      <div className="px-5 mb-5">
        {loading && !status ? (
          <div className="rounded-xl p-6 flex justify-center" style={{ background: '#1E293B' }}>
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div
            className="rounded-xl p-5"
            style={{
              background: isTaskRunning ? 'linear-gradient(135deg, #064E3B88, #1E293B)' : '#1E293B',
              border: isTaskRunning ? '1px solid #34D39933' : '1px solid #334155',
            }}
          >
            {robot && (
              <p className={`text-[10px] uppercase tracking-widest font-medium mb-1 ${
                isTaskRunning ? 'text-green-400' : 'text-gray-500'
              }`}>
                {robot.modelTypeCode}
              </p>
            )}

            <h2 className="text-xl font-bold text-white mb-3">
              {isTaskRunning
                ? status?.currentTask || 'Running task'
                : isTaskPaused
                ? 'Paused'
                : 'Idle'}
            </h2>

            {/* Battery + Map + Water levels */}
            <div className="flex items-center gap-4 text-xs mb-4 flex-wrap">
              {status && (
                <span className={status.battery > 50 ? 'text-green-400' : status.battery > 20 ? 'text-yellow-400' : 'text-red-400'}>
                  <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.375c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H21M3.75 18h15A2.25 2.25 0 0021 15.75v-6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 001.5 9.75v6A2.25 2.25 0 003.75 18z" />
                  </svg>
                  {status.battery}%
                </span>
              )}
              {robot && isScrubber(robot.modelTypeCode) && status?.cleanWater != null && (
                <>
                  <span className="text-blue-400">
                    <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m-7.071-2.929l.707-.707m12.728 0l.707.707M3 12h1m16 0h1" />
                    </svg>
                    {status.cleanWater}%
                  </span>
                  <span className="text-amber-500">
                    <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    {status.dirtyWater ?? 0}%
                  </span>
                </>
              )}
              {status?.currentMap && (
                <span className="text-gray-400">{status.currentMap}</span>
              )}
            </div>

            {/* Progress bar for running task */}
            {isTaskRunning && (
              <div className="mb-4">
                <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-green-500 animate-progress" />
                </div>
              </div>
            )}

            {/* Action buttons for running/paused task */}
            {(isTaskRunning || isTaskPaused) && (
              <div className="flex gap-3">
                {isTaskRunning && (
                  <button
                    onClick={() => handleAgentCommand('Pause the current task')}
                    className="flex-1 h-12 rounded-xl font-semibold text-sm transition-colors"
                    style={{ background: '#78350F', color: '#FBBF24' }}
                  >
                    Pause
                  </button>
                )}
                {isTaskPaused && (
                  <button
                    onClick={() => handleAgentCommand('Resume the current task')}
                    className="flex-1 h-12 rounded-xl font-semibold text-sm bg-blue-600 text-white transition-colors"
                  >
                    Resume
                  </button>
                )}
                <button
                  onClick={() => handleAgentCommand('Stop the current task')}
                  className="flex-1 h-12 rounded-xl font-semibold text-sm transition-colors"
                  style={{ background: '#7F1D1D', color: '#FCA5A5' }}
                >
                  Stop
                </button>
              </div>
            )}

            {/* Localization warning */}
            {status && !status.localized && (
              <div className="mt-4 rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">
                  <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Robot not localized — commands may fail
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-5">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium mb-3">Quick actions</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setTaskPickerOpen(true)}
            className="rounded-xl p-4 text-left transition-colors active:scale-[0.98] hover:bg-white/5"
            style={{ background: '#1E293B', border: '1px solid #334155' }}
          >
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">
              {allTasks.length > 0 ? 'Start task' : allWorkModes.length > 0 ? 'Clean modes' : 'Start task'}
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {allTasks.length > 0
                ? `${allTasks.length} available`
                : allWorkModes.length > 0
                ? `${allWorkModes.length} modes`
                : '0 available'}
            </p>
          </button>

          <button
            onClick={() => setNavPickerOpen(true)}
            className="rounded-xl p-4 text-left transition-colors active:scale-[0.98] hover:bg-white/5"
            style={{ background: '#1E293B', border: '1px solid #334155' }}
          >
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">Navigate</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{allPositions.length} points</p>
          </button>
        </div>
      </div>

      {/* Task picker bottom sheet */}
      {taskPickerOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setTaskPickerOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl max-h-[60vh] flex flex-col animate-slide-up"
            style={{ background: '#1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-white">
                {allTasks.length > 0 ? 'Select a task' : 'Select cleaning mode'}
              </h3>
              <button onClick={() => setTaskPickerOpen(false)} className="text-gray-500 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {allTasks.length === 0 && allWorkModes.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No tasks or cleaning modes available</p>
              ) : (
                <>
                  {allTasks.map((task) => (
                    <button
                      key={task}
                      onClick={() => {
                        setTaskPickerOpen(false);
                        handleAgentCommand(`Start task "${task}"`);
                      }}
                      className="w-full text-left px-5 py-4 border-b border-gray-700/50 hover:bg-white/5 active:bg-white/10 transition-colors"
                    >
                      <p className="text-sm text-white">{task}</p>
                    </button>
                  ))}
                  {allTasks.length === 0 && allWorkModes.map((wm) => (
                    <button
                      key={wm.id}
                      onClick={() => {
                        setTaskPickerOpen(false);
                        handleAgentCommand(`Start cleaning in "${wm.name}" mode`);
                      }}
                      className="w-full text-left px-5 py-4 border-b border-gray-700/50 hover:bg-white/5 active:bg-white/10 transition-colors"
                    >
                      <p className="text-sm text-white">{wm.name}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">Cleaning mode</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Nav picker bottom sheet */}
      {navPickerOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setNavPickerOpen(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl max-h-[60vh] flex flex-col animate-slide-up"
            style={{ background: '#1E293B' }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-white">Navigate to</h3>
              <button onClick={() => setNavPickerOpen(false)} className="text-gray-500 hover:text-white p-1">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {allPositions.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No navigation points available</p>
              ) : (
                allPositions.map((pos) => (
                  <button
                    key={pos.name}
                    onClick={() => {
                      setNavPickerOpen(false);
                      handleAgentCommand(`Navigate to "${pos.name}"`);
                    }}
                    className="w-full text-left px-5 py-4 border-b border-gray-700/50 hover:bg-white/5 active:bg-white/10 transition-colors"
                  >
                    <p className="text-sm text-white">{pos.name}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Voice Bar */}
      <VoiceBar
        contextHint={isTaskRunning ? 'Pause task' : 'Navigate to charger'}
        onOpenAgent={handleOpenAgent}
        onVoiceMessage={handleVoiceMessage}
      />

      {/* Agent Overlay */}
      <AgentOverlay
        isOpen={agentOpen}
        onClose={() => setAgentOpen(false)}
        messages={messages}
        isLoading={chatLoading}
        onSend={handleSend}
        ttsEnabled={ttsEnabled}
        onToggleTTS={toggleTTS}
      />
    </div>
  );
}
