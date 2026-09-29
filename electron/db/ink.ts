import { randomUUID } from "node:crypto";
import type { App } from "electron";
import { getDatabase } from "./connection.js";
import { getPracticeSession } from "./practice.js";
import type {
  InkLayer,
  InkResponseDetail,
  InkSaveResult,
  InkStroke,
  SaveInkResponseInput,
} from "../types.js";

export function saveInkResponse(
  app: App,
  input: SaveInkResponseInput
): InkSaveResult {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const sessionId = input.sessionId ?? crypto.randomUUID();
  let responseId = "";
  const transaction = db.transaction(() => {
    const existing = db
      .prepare("SELECT id FROM practice_sessions WHERE id = ?")
      .get(sessionId);
    if (!existing)
      db.prepare(
        `INSERT INTO practice_sessions (id, reference_key, title, status, started_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`
      ).run(sessionId, input.referenceKey, input.title, now, now);
    const version =
      (
        db
          .prepare(
            "SELECT COALESCE(MAX(version), 0) AS value FROM practice_responses WHERE session_id = ?"
          )
          .get(sessionId) as { value: number }
      ).value + 1;
    responseId = crypto.randomUUID();
    const strokeCount = input.layers.reduce(
      (sum, layer) => sum + layer.strokes.length,
      0
    );
    db.prepare(
      `INSERT INTO practice_responses (id, session_id, answer_format, content, status, version, created_at, updated_at) VALUES (?, ?, 'handwritten', ?, ?, ?, ?, ?)`
    ).run(
      responseId,
      sessionId,
      `笔迹作答：${strokeCount} 个笔画`,
      input.status,
      version,
      now,
      now
    );
    db.prepare(
      `UPDATE practice_sessions SET status = ?, updated_at = ?, submitted_at = CASE WHEN ? = 'submitted' THEN ? ELSE submitted_at END WHERE id = ?`
    ).run(
      input.status === "submitted" ? "submitted" : "active",
      now,
      input.status,
      now,
      sessionId
    );
    const insertLayer = db.prepare(
      `INSERT INTO ink_layers (id, response_id, title, ordinal, is_visible, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertStroke = db.prepare(
      `INSERT INTO ink_strokes (id, layer_id, ordinal, tool, color, width, points_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const layer of input.layers) {
      const layerId = layer.id ?? crypto.randomUUID();
      insertLayer.run(
        layerId,
        responseId,
        layer.title.slice(0, 120),
        layer.ordinal,
        layer.visible ? 1 : 0,
        now,
        now
      );
      for (const stroke of layer.strokes)
        insertStroke.run(
          stroke.id ?? crypto.randomUUID(),
          layerId,
          stroke.ordinal,
          stroke.tool,
          stroke.color,
          stroke.width,
          JSON.stringify(stroke.points),
          now
        );
    }
    db.prepare(
      `INSERT INTO ink_snapshots (id, response_id, canvas_width, canvas_height, preview_svg, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      responseId,
      input.canvasWidth,
      input.canvasHeight,
      input.previewSvg.slice(0, 2_000_000),
      now
    );
  });
  transaction();
  return {
    session: getPracticeSession(app, sessionId)!,
    ink: getInkResponse(app, responseId)!,
  };
}

export function getInkResponse(
  app: App,
  responseId: string
): InkResponseDetail | null {
  const db = getDatabase(app);
  const snapshot = db
    .prepare(
      `SELECT s.response_id AS responseId, r.session_id AS sessionId, s.canvas_width AS canvasWidth, s.canvas_height AS canvasHeight, s.preview_svg AS previewSvg, s.created_at AS createdAt FROM ink_snapshots s JOIN practice_responses r ON r.id = s.response_id WHERE s.response_id = ?`
    )
    .get(responseId) as Omit<InkResponseDetail, "layers"> | undefined;
  if (!snapshot) return null;
  const layers = db
    .prepare(
      `SELECT id, title, ordinal, is_visible AS visible FROM ink_layers WHERE response_id = ? ORDER BY ordinal`
    )
    .all(responseId) as Array<{
    id: string;
    title: string;
    ordinal: number;
    visible: number;
  }>;
  const strokes = db
    .prepare(
      `SELECT id, layer_id AS layerId, ordinal, tool, color, width, points_json AS pointsJson FROM ink_strokes WHERE layer_id IN (SELECT id FROM ink_layers WHERE response_id = ?) ORDER BY ordinal`
    )
    .all(responseId) as Array<{
    id: string;
    layerId: string;
    ordinal: number;
    tool: "pen" | "eraser";
    color: string;
    width: number;
    pointsJson: string;
  }>;
  return {
    ...snapshot,
    layers: layers.map(layer => ({
      ...layer,
      visible: Boolean(layer.visible),
      strokes: strokes
        .filter(stroke => stroke.layerId === layer.id)
        .map(
          ({ layerId: _layerId, pointsJson, ...stroke }) =>
            ({ ...stroke, points: JSON.parse(pointsJson) }) as InkStroke
        ),
    })),
  };
}
