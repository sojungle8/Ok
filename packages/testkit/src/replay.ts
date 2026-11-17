/** Run a replay function several times and return the distinct hashes (expect exactly one). */
export function distinctReplayHashes(run: () => string, times = 3): string[] {
  const seen = new Set<string>();
  for (let i = 0; i < times; i += 1) seen.add(run());
  return [...seen];
}
