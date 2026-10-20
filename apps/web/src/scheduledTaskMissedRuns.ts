import type { EnvironmentId, ScheduledTask } from "@t3tools/contracts";

const STORAGE_KEY = "t3code:scheduled-task-missed-runs-notified";

/**
 * The missed run each task was last announced for, keyed by environment and
 * task. Stored so a miss found while no window was open still notifies when
 * one opens, and only once.
 */
export type AnnouncedMissedRuns = Readonly<Record<string, string>>;

export function takeUnannouncedMissedRuns(
  environmentId: EnvironmentId,
  tasks: ReadonlyArray<ScheduledTask>,
  announced: AnnouncedMissedRuns,
): { readonly due: ReadonlyArray<ScheduledTask>; readonly announced: AnnouncedMissedRuns } {
  const prefix = `${environmentId}:`;
  // A cleared miss drops out, so this environment keeps only current ones.
  const next: Record<string, string> = Object.fromEntries(
    Object.entries(announced).filter(([key]) => !key.startsWith(prefix)),
  );
  const due: ScheduledTask[] = [];
  for (const task of tasks) {
    if (task.missedRunAt === undefined) continue;
    const key = `${prefix}${task.id}`;
    if (announced[key] !== task.missedRunAt) due.push(task);
    next[key] = task.missedRunAt;
  }
  return { due, announced: next };
}

export function readAnnouncedMissedRuns(): AnnouncedMissedRuns {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

export function writeAnnouncedMissedRuns(announced: AnnouncedMissedRuns) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(announced));
  } catch {
    // Blocked storage only means a miss may be announced again after a reload.
  }
}
