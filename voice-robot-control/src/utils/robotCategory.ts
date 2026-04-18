export type RobotCategory = 'scrubber' | 'vacuum' | 'sweeper' | 'unknown';

export function getRobotCategory(modelTypeCode: string): RobotCategory {
  const lower = modelTypeCode.toLowerCase();
  if (lower.includes('scrub') || lower.includes('wash') || lower.includes('mop')) return 'scrubber';
  if (lower.includes('vacuum') || lower.includes('phantas')) return 'vacuum';
  if (lower.includes('sweep')) return 'sweeper';
  return 'unknown';
}

export function isScrubber(modelTypeCode: string): boolean {
  return getRobotCategory(modelTypeCode) === 'scrubber';
}

/**
 * Whether a robot's UI should include the clean/dirty water rows. Pudu
 * commercial cleaners always report water levels, so they count regardless
 * of modelTypeCode. For other manufacturers, fall back to the scrubber
 * heuristic on modelTypeCode.
 */
export function showsWaterLevels(
  robotType: 'gausium' | 'pudu' | undefined,
  modelTypeCode: string | undefined
): boolean {
  if (robotType === 'pudu') return true;
  return !!(modelTypeCode && isScrubber(modelTypeCode));
}

/**
 * Short, human-readable manufacturer label for the robot badge in the UI.
 */
export function manufacturerLabel(robotType: 'gausium' | 'pudu' | undefined): string {
  if (robotType === 'pudu') return 'Pudu';
  if (robotType === 'gausium') return 'Gausium';
  return '';
}
