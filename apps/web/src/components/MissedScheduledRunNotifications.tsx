import type { AnyRouter } from "@tanstack/react-router";
import type { EnvironmentId, ScheduledTask } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, type AtomRegistry } from "effect/reactivity";
import { CalendarClockIcon } from "lucide-react";

import { getClientSettings } from "../hooks/useSettings";
import {
  readAnnouncedMissedRuns,
  takeUnannouncedMissedRuns,
  writeAnnouncedMissedRuns,
} from "../scheduledTaskMissedRuns";
import { serverEnvironment } from "../state/server";
import {
  hasDesktopNotifications,
  hasNotificationSound,
  playNotificationSound,
} from "../threadNotifications";
import { formatDayAwareTimestamp } from "../timestampFormat";
import { toastManager } from "./ui/toast";

/**
 * Tells the user when a timed task's run was skipped because the environment wasn't running at
 * its time. A miss has no thread, so it can't use the thread notifications; it follows the same
 * notification settings.
 */
export function watchMissedScheduledRuns(
  registry: AtomRegistry.AtomRegistry,
  router: AnyRouter,
  environmentId: EnvironmentId,
  trackNotification: (environmentId: EnvironmentId, notification: Notification) => void,
): () => void {
  const open = (task: ScheduledTask) =>
    void router.navigate({
      to: "/settings/scheduled-tasks",
      search: { environmentId, taskId: task.id },
    });

  const present = (due: ReadonlyArray<ScheduledTask>) => {
    const {
      notificationMode: mode,
      inAppNotificationsEnabled,
      timestampFormat,
    } = getClientSettings();
    const title = (task: ScheduledTask) => `${task.title} missed a run`;
    const body = (task: ScheduledTask) =>
      `It was due ${formatDayAwareTimestamp(task.missedRunAt ?? "", timestampFormat)}, but the environment wasn't running.`;
    if (hasNotificationSound(mode)) {
      void playNotificationSound("input", () =>
        hasNotificationSound(getClientSettings().notificationMode),
      );
    }
    const focused = document.visibilityState === "visible" && document.hasFocus();
    for (const task of due) {
      if (inAppNotificationsEnabled && focused) {
        const toastId = toastManager.add({
          type: "warning",
          title: title(task),
          description: body(task),
          data: {
            hideCopyButton: true,
            leadingIcon: (
              <CalendarClockIcon aria-hidden className="size-4 text-warning-foreground" />
            ),
          },
          actionProps: {
            children: "Open task",
            onClick: () => {
              toastManager.close(toastId);
              open(task);
            },
          },
        });
        continue;
      }
      if (
        !hasDesktopNotifications(mode) ||
        focused ||
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      )
        continue;
      try {
        const notification = new Notification(title(task), {
          body: body(task),
          tag: `${environmentId}:${task.id}`,
          silent: true,
        });
        trackNotification(environmentId, notification);
        notification.addEventListener("click", () => {
          notification.close();
          window.focus();
          void window.desktopBridge?.revealWindow?.().catch(() => undefined);
          open(task);
        });
      } catch {
        // Some browsers expose Notification but reject desktop presentation.
      }
    }
  };

  return registry.subscribe(
    serverEnvironment.scheduledTasksLive({ environmentId, input: {} }),
    (result) => {
      const tasks = Option.getOrNull(AsyncResult.value(result))?.tasks;
      if (tasks === undefined) return;
      const { due, announced } = takeUnannouncedMissedRuns(
        environmentId,
        tasks,
        readAnnouncedMissedRuns(),
      );
      writeAnnouncedMissedRuns(announced);
      if (due.length > 0) present(due);
    },
    { immediate: true },
  );
}
