import type { ParsedCommand } from '../types';

interface Props {
  command: ParsedCommand | null;
  result: 'success' | 'error' | null;
  error: string | null;
}

export function CommandConfirmation({ command, result, error }: Props) {
  if (!command && !error) return null;

  if (error && !command) {
    return (
      <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
        Error: {error}
      </div>
    );
  }

  if (!command) return null;

  const intentLabel = command.intent.replace(/_/g, ' ').toUpperCase();

  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm border ${
        result === 'success'
          ? 'bg-green-900/40 border-green-700 text-green-300'
          : result === 'error'
          ? 'bg-red-900/40 border-red-700 text-red-300'
          : 'bg-gray-800 border-gray-600 text-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{intentLabel}</span>
        <span className="text-xs">
          {result === 'success' ? 'Accepted' : result === 'error' ? 'Failed' : 'Pending'}
        </span>
      </div>
      <p className="mt-1 text-xs opacity-80">{command.confirmationMessage}</p>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      <div className="mt-1 text-xs opacity-50">Confidence: {(command.confidence * 100).toFixed(0)}%</div>
    </div>
  );
}
