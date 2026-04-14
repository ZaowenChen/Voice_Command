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
