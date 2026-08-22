import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { exportBackup, preflightBackup, restoreBackup } from "../dist/electron/backup.js";
import { closeDatabase, getInkResponse, saveInkResponse } from "../dist/electron/database.js";

const root = await mkdtemp(path.join(os.tmpdir(), "my-euclid-ink-flow-"));
const app = { getPath: (name) => name === "userData" ? path.join(root, "user-data") : path.join(root, "temp") };
const point = (x, y, t) => ({ x, y, pressure: 0.7, t });

try {
  await mkdir(app.getPath("userData"), { recursive: true });
  const initial = saveInkResponse(app, {
    referenceKey: "E-2025-07b", title: "Euclid 2025 · 第 7 题 (b)", status: "draft", canvasWidth: 900, canvasHeight: 560,
    previewSvg: '<svg viewBox="0 0 900 560"><path d="M10 10 L100 100"/></svg>',
    layers: [
      { title: "主笔迹", ordinal: 1, visible: true, strokes: [{ ordinal: 0, tool: "pen", color: "#163A5F", width: 4, points: [point(0.05, 0.05, 0), point(0.2, 0.2, 120)] }] },
      { title: "推导", ordinal: 2, visible: true, strokes: [{ ordinal: 0, tool: "pen", color: "#A94132", width: 3, points: [point(0.3, 0.3, 0), point(0.4, 0.42, 80)] }] },
    ],
  });
  if (initial.ink.layers.length !== 2 || initial.ink.layers[0].strokes[0].points.length !== 2) throw new Error("Ink layers or points were not persisted.");
  const backupPath = path.join(root, "ink.myeuclid-backup.zip");
  await exportBackup(app, backupPath);
  saveInkResponse(app, { referenceKey: "E-2025-07b", title: "extra", status: "draft", canvasWidth: 900, canvasHeight: 560, previewSvg: "<svg/>", layers: [{ title: "extra", ordinal: 1, visible: true, strokes: [] }] });
  const selection = await preflightBackup(app, backupPath);
  await restoreBackup(app, selection.token);
  const restored = getInkResponse(app, initial.ink.responseId);
  if (!restored || restored.layers.length !== 2 || restored.layers[1].strokes[0].points[1].t !== 80) throw new Error("Ink backup restore did not preserve replay sequence.");
  console.log("Ink canvas persistence and backup smoke test passed");
} finally {
  closeDatabase();
  await rm(root, { recursive: true, force: true });
}

process.exit(0);
