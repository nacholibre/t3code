import type { EnvironmentId, ScheduledTask } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { takeUnannouncedMissedRuns } from "./scheduledTaskMissedRuns";

const environmentId = "env-a" as EnvironmentId;
const task = (id: string, missedRunAt?: string) =>
  ({ id, ...(missedRunAt === undefined ? {} : { missedRunAt }) }) as ScheduledTask;

describe("takeUnannouncedMissedRuns", () => {
  it("announces each missed run once", () => {
    const first = takeUnannouncedMissedRuns(
      environmentId,
      [task("monthly", "2026-11-04T07:00:00.000Z"), task("daily")],
      {},
    );
    expect(first.due.map((due) => due.id)).toEqual(["monthly"]);

    const again = takeUnannouncedMissedRuns(
      environmentId,
      [task("monthly", "2026-11-04T07:00:00.000Z"), task("daily")],
      first.announced,
    );
    expect(again.due).toEqual([]);
  });

  it("announces a later miss of the same task", () => {
    const { announced } = takeUnannouncedMissedRuns(
      environmentId,
      [task("monthly", "2026-11-04T07:00:00.000Z")],
      {},
    );
    const later = takeUnannouncedMissedRuns(
      environmentId,
      [task("monthly", "2026-12-04T07:00:00.000Z")],
      announced,
    );
    expect(later.due.map((due) => due.id)).toEqual(["monthly"]);
  });

  it("forgets runs that were cleared and keeps other environments' runs", () => {
    const other = { "env-b:monthly": "2026-11-04T07:00:00.000Z" };
    const { announced } = takeUnannouncedMissedRuns(
      environmentId,
      [task("monthly", "2026-11-04T07:00:00.000Z")],
      other,
    );
    expect(
      takeUnannouncedMissedRuns(environmentId, [task("monthly")], announced).announced,
    ).toEqual(other);
  });
});
