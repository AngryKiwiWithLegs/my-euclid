import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const directory = mkdtempSync(path.join(tmpdir(), "my-euclid-sqlite-"));
const databasePath = path.join(directory, "smoke.sqlite");

try {
  const db = new Database(databasePath);
  db.exec(
    "CREATE TABLE archive_test (id TEXT PRIMARY KEY, label TEXT NOT NULL)"
  );
  db.prepare("INSERT INTO archive_test (id, label) VALUES (?, ?)").run(
    "source-001",
    "Euclid import"
  );
  const row = db
    .prepare("SELECT label FROM archive_test WHERE id = ?")
    .get("source-001");
  db.close();
  if (!row || row.label !== "Euclid import")
    throw new Error("SQLite round trip returned an unexpected result.");
  console.log("SQLite Electron ABI smoke test passed");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
process.exit(0);
