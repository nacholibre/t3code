import * as Effect from "effect/Effect";
import * as SqlClient from "effect/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // A column rather than a new last_run_status value: clients that predate it
  // would drop a task with an unknown status from their list.
  yield* sql`ALTER TABLE scheduled_tasks ADD COLUMN missed_run_at TEXT`;
});
