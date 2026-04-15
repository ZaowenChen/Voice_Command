import { useState, useCallback } from 'react';
import { useAudioRecorder } from './useAudioRecorder';
import type { ParsedCommand, CommandHistoryEntry, MapInfo } from '../types';
import { sendVoiceAudio, parseTranscript, sendRobotCommand } from '../services/api';

interface VoiceCommandState {
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string | null;
  command: ParsedCommand | null;
  commandResult: 'success' | 'error' | null;
  error: string | null;
}

export function useVoiceCommand(
  serialNumber: string | null,
  currentMap: MapInfo | null,
  onCommandComplete?: (entry: CommandHistoryEntry) => void
) {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [state, setState] = useState<VoiceCommandState>({
    isRecording: false,
    isProcessing: false,
    transcript: null,
    command: null,
    commandResult: null,
    error: null,
  });

  const handleStartRecording = useCallback(async () => {
    setState((s) => ({
      ...s,
      transcript: null,
      command: null,
      commandResult: null,
      error: null,
    }));
    try {
      await startRecording();
    } catch (err: any) {
      setState((s) => ({ ...s, error: 'Microphone access denied' }));
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    if (!serialNumber) {
      setState((s) => ({ ...s, error: 'No robot selected' }));
      return;
    }

    setState((s) => ({ ...s, isProcessing: true }));

    try {
      const audioBlob = await stopRecording();
      if (audioBlob.size === 0) throw new Error('No audio recorded');

      // Step 1: Transcribe
      const { transcript } = await sendVoiceAudio(audioBlob);
      setState((s) => ({ ...s, transcript }));

      // Step 2: Parse intent
      const context = {
        serialNumber,
        currentMap: currentMap?.name,
        currentMapId: currentMap?.id,
        availableTasks: currentMap?.tasks.map((t) => t.name) || [],
        availablePositions: currentMap?.positions.map((p) => p.name) || [],
      };
      const command = await parseTranscript(transcript, context);
      setState((s) => ({ ...s, command }));

      // Step 3: Execute command
      if (command.intent !== 'unknown' && command.intent !== 'status') {
        const commandBody = buildCommandBody(serialNumber, command, currentMap);
        await sendRobotCommand(serialNumber, commandBody);
      }

      setState((s) => ({ ...s, commandResult: 'success', isProcessing: false }));

      // Add to history
      onCommandComplete?.({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        transcript,
        command,
        result: 'success',
      });
    } catch (err: any) {
      setState((s) => ({
        ...s,
        error: err.message,
        commandResult: 'error',
        isProcessing: false,
      }));

      if (state.transcript && state.command) {
        onCommandComplete?.({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          transcript: state.transcript,
          command: state.command,
          result: 'error',
          errorMessage: err.message,
        });
      }
    }
  }, [serialNumber, currentMap, stopRecording, onCommandComplete]);

  return {
    isRecording,
    isProcessing: state.isProcessing,
    transcript: state.transcript,
    command: state.command,
    commandResult: state.commandResult,
    error: state.error,
    startRecording: handleStartRecording,
    stopRecording: handleStopRecording,
  };
}

function buildCommandBody(
  sn: string,
  command: ParsedCommand,
  currentMap: MapInfo | null
): any {
  const mapId = command.parameters.mapId || currentMap?.id;

  switch (command.intent) {
    case 'start_task': {
      const taskName = command.parameters.taskName || '';
      return {
        serialNumber: sn,
        remoteTaskCommandType: 'START_TASK',
        commandParameter: {
          startTaskParameter: {
            cleaningMode: command.parameters.cleaningMode,
            task: {
              map: mapId,
              name: taskName,
              loop: false,
              loopCount: 1,
            },
          },
        },
      };
    }
    case 'pause_task':
      return { serialNumber: sn, remoteTaskCommandType: 'PAUSE_TASK' };
    case 'resume_task':
      return { serialNumber: sn, remoteTaskCommandType: 'RESUME_TASK' };
    case 'stop_task':
      return { serialNumber: sn, remoteTaskCommandType: 'STOP_TASK' };
    case 'navigate':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'CROSS_NAVIGATE',
        commandParameter: {
          startNavigationParameter: {
            map: mapId,
            position: command.parameters.position,
          },
        },
      };
    case 'pause_navigate':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'PAUSE_NAVIGATE',
        commandParameter: { startNavigationParameter: { map: mapId } },
      };
    case 'resume_navigate':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'RESUME_NAVIGATE',
        commandParameter: { startNavigationParameter: { map: mapId } },
      };
    case 'stop_navigate':
      return {
        serialNumber: sn,
        remoteNavigationCommandType: 'STOP_NAVIGATE',
        commandParameter: { startNavigationParameter: { map: mapId } },
      };
    default:
      return { serialNumber: sn };
  }
}
