import type { Robot, RobotStatus, MapInfo } from '../../types';
import { HeroStatus } from './HeroStatus';
import { VitalsPanel } from './VitalsPanel';
import { ActiveTask } from './ActiveTask';
import { TaskGrid } from './TaskGrid';

interface Props {
  robot: Robot | null;
  status: RobotStatus | null;
  statusLoading: boolean;
  currentMap: MapInfo | null;
  onAgentCommand: (command: string) => void;
}

export function Dashboard({ robot, status, statusLoading, currentMap, onAgentCommand }: Props) {
  return (
    <div className="space-y-4">
      <HeroStatus robot={robot} status={status} loading={statusLoading} />

      {robot && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <VitalsPanel status={status} online={robot.online} />
            <ActiveTask status={status} onAgentCommand={onAgentCommand} />
          </div>
          <TaskGrid currentMap={currentMap} onAgentCommand={onAgentCommand} />
        </>
      )}
    </div>
  );
}
