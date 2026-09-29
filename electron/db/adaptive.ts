import type { App } from "electron";
import { getDatabase } from "./connection.js";
import { listQuestionBank } from "./questionBank.js";
import type {
  AbilitySnapshot,
  AdaptiveRecommendation,
  AdaptiveTrainingProfile,
  IrtItemParameter,
  KnowledgeEdge,
  KnowledgeNode,
  QuestionBankQuestion,
  QuestionKnowledgeMapping,
  SaveIrtItemParameterInput,
  SaveKnowledgeEdgeInput,
  SaveKnowledgeNodeInput,
} from "../types.js";

export function saveKnowledgeNode(app: App, input: SaveKnowledgeNodeInput) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  const name = input.name.trim();
  if (!name || name.length > 100 || input.description.length > 1000)
    throw new Error("知识节点名称或说明无效。");
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO knowledge_nodes (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, updated_at = excluded.updated_at`
  ).run(id, name, input.description.trim(), now, now);
  return db
    .prepare(
      `SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM knowledge_nodes WHERE id = ?`
    )
    .get(id) as KnowledgeNode;
}

export function saveKnowledgeEdge(app: App, input: SaveKnowledgeEdgeInput) {
  const db = getDatabase(app);
  if (
    !input.prerequisiteNodeId ||
    !input.dependentNodeId ||
    input.prerequisiteNodeId === input.dependentNodeId ||
    !Number.isFinite(input.strength) ||
    input.strength <= 0 ||
    input.strength > 1
  )
    throw new Error("知识依赖关系无效。");
  const id = input.id ?? crypto.randomUUID();
  db.prepare(
    `INSERT INTO knowledge_edges (id, prerequisite_node_id, dependent_node_id, strength) VALUES (?, ?, ?, ?) ON CONFLICT(prerequisite_node_id, dependent_node_id) DO UPDATE SET strength = excluded.strength`
  ).run(id, input.prerequisiteNodeId, input.dependentNodeId, input.strength);
  return db
    .prepare(
      `SELECT id, prerequisite_node_id AS prerequisiteNodeId, dependent_node_id AS dependentNodeId, strength FROM knowledge_edges WHERE prerequisite_node_id = ? AND dependent_node_id = ?`
    )
    .get(input.prerequisiteNodeId, input.dependentNodeId) as KnowledgeEdge;
}

export function saveQuestionIrtParameter(
  app: App,
  input: SaveIrtItemParameterInput
) {
  const db = getDatabase(app);
  const now = new Date().toISOString();
  if (
    !Number.isFinite(input.difficulty) ||
    input.difficulty < -4 ||
    input.difficulty > 4 ||
    !Number.isFinite(input.discrimination) ||
    input.discrimination <= 0 ||
    input.discrimination > 4 ||
    !Number.isFinite(input.guessing) ||
    input.guessing < 0 ||
    input.guessing >= 0.5 ||
    !Array.isArray(input.nodeIds) ||
    !input.nodeIds.length ||
    input.nodeIds.length > 8
  )
    throw new Error("IRT 项目参数或知识映射无效。");
  const save = db.transaction(() => {
    const question = db
      .prepare(
        `SELECT id FROM question_bank WHERE id = ? AND status = 'published'`
      )
      .get(input.questionId);
    if (!question) throw new Error("只能为已发布题目设置 IRT 参数。");
    db.prepare(
      `INSERT INTO question_irt_parameters (question_id, difficulty, discrimination, guessing, source, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(question_id) DO UPDATE SET difficulty = excluded.difficulty, discrimination = excluded.discrimination, guessing = excluded.guessing, source = excluded.source, updated_at = excluded.updated_at`
    ).run(
      input.questionId,
      input.difficulty,
      input.discrimination,
      input.guessing,
      input.source,
      now
    );
    db.prepare(
      `DELETE FROM question_knowledge_mappings WHERE question_id = ?`
    ).run(input.questionId);
    const insert = db.prepare(
      `INSERT INTO question_knowledge_mappings (question_id, node_id, weight) VALUES (?, ?, ?)`
    );
    for (const nodeId of Array.from(new Set(input.nodeIds))) {
      if (
        !db.prepare(`SELECT id FROM knowledge_nodes WHERE id = ?`).get(nodeId)
      )
        throw new Error("题目映射了不存在的知识节点。");
      insert.run(input.questionId, nodeId, 1);
    }
  });
  save();
  return db
    .prepare(
      `SELECT question_id AS questionId, difficulty, discrimination, guessing, source, updated_at AS updatedAt FROM question_irt_parameters WHERE question_id = ?`
    )
    .get(input.questionId) as IrtItemParameter;
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-Math.max(-35, Math.min(35, value))));
}
function questionParameter(
  question: QuestionBankQuestion,
  parameter?: IrtItemParameter
): IrtItemParameter {
  return (
    parameter ?? {
      questionId: question.id,
      difficulty: ((question.difficulty ?? 3) - 3) * 0.8,
      discrimination: 1,
      guessing: 0,
      source: "heuristic",
      updatedAt: question.updatedAt,
    }
  );
}
function predictedProbability(theta: number, parameter: IrtItemParameter) {
  return (
    parameter.guessing +
    (1 - parameter.guessing) *
      logistic(1.7 * parameter.discrimination * (theta - parameter.difficulty))
  );
}

export function getAdaptiveTrainingProfile(app: App): AdaptiveTrainingProfile {
  const db = getDatabase(app);
  const nodes = db
    .prepare(
      `SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt FROM knowledge_nodes ORDER BY name`
    )
    .all() as KnowledgeNode[];
  const edges = db
    .prepare(
      `SELECT id, prerequisite_node_id AS prerequisiteNodeId, dependent_node_id AS dependentNodeId, strength FROM knowledge_edges ORDER BY dependent_node_id`
    )
    .all() as KnowledgeEdge[];
  const mappings = db
    .prepare(
      `SELECT question_id AS questionId, node_id AS nodeId, weight FROM question_knowledge_mappings`
    )
    .all() as QuestionKnowledgeMapping[];
  const storedParameters = db
    .prepare(
      `SELECT question_id AS questionId, difficulty, discrimination, guessing, source, updated_at AS updatedAt FROM question_irt_parameters`
    )
    .all() as IrtItemParameter[];
  const questions = listQuestionBank(app, { limit: 500 });
  const parameters = questions.map(question =>
    questionParameter(
      question,
      storedParameters.find(parameter => parameter.questionId === question.id)
    )
  );
  const evidence = db
    .prepare(
      `SELECT a.score_awarded * 1.0 / a.score_maximum AS scoreRate, m.node_id AS nodeId, m.weight, q.id AS questionId
    FROM assessment_records a JOIN practice_sessions s ON s.id = a.session_id
    LEFT JOIN mock_exam_items mi ON mi.practice_session_id = s.id
    LEFT JOIN question_bank q ON q.id = CASE WHEN mi.question_id IS NOT NULL THEN mi.question_id ELSE s.reference_key END
    JOIN question_knowledge_mappings m ON m.question_id = q.id
    WHERE a.status = 'confirmed'`
    )
    .all() as Array<{
    scoreRate: number;
    nodeId: string;
    weight: number;
    questionId: string;
  }>;
  const abilityMap = new Map<string, AbilitySnapshot>();
  for (const node of nodes) {
    const samples = evidence.filter(item => item.nodeId === node.id);
    let theta = 0;
    let information = 1;
    for (const sample of samples) {
      const parameter = parameters.find(
        item => item.questionId === sample.questionId
      );
      if (!parameter) continue;
      const p = predictedProbability(theta, parameter);
      const derivative =
        (1 - parameter.guessing) *
        1.7 *
        parameter.discrimination *
        logistic(
          1.7 * parameter.discrimination * (theta - parameter.difficulty)
        ) *
        (1 -
          logistic(
            1.7 * parameter.discrimination * (theta - parameter.difficulty)
          ));
      theta += Math.max(
        -0.7,
        Math.min(
          0.7,
          (((sample.scoreRate - p) * derivative) /
            (derivative * derivative + 0.08)) *
            sample.weight
        )
      );
      information += sample.weight * derivative * derivative;
    }
    const snapshot = {
      nodeId: node.id,
      theta: Number(theta.toFixed(3)),
      standardError: Number((1 / Math.sqrt(information)).toFixed(3)),
      evidenceCount: samples.length,
      updatedAt: new Date().toISOString(),
    };
    abilityMap.set(node.id, snapshot);
  }
  const abilities = Array.from(abilityMap.values());
  const persist = db.transaction(() => {
    const statement = db.prepare(
      `INSERT INTO learner_ability_snapshots (node_id, theta, standard_error, evidence_count, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(node_id) DO UPDATE SET theta = excluded.theta, standard_error = excluded.standard_error, evidence_count = excluded.evidence_count, updated_at = excluded.updated_at`
    );
    abilities.forEach(item =>
      statement.run(
        item.nodeId,
        item.theta,
        item.standardError,
        item.evidenceCount,
        item.updatedAt
      )
    );
  });
  persist();
  const recommendations: AdaptiveRecommendation[] = [];
  const used = new Set<string>();
  const weakNodes = [...nodes].sort(
    (left, right) =>
      (abilityMap.get(left.id)?.theta ?? 0) -
      (abilityMap.get(right.id)?.theta ?? 0)
  );
  for (const node of weakNodes.slice(0, 3)) {
    const target = abilityMap.get(node.id) ?? { theta: 0 };
    const prerequisites = edges
      .filter(edge => edge.dependentNodeId === node.id)
      .map(edge => edge.prerequisiteNodeId);
    const choose = (
      nodeId: string,
      reason: AdaptiveRecommendation["reason"],
      desired: number
    ) => {
      const candidate = questions
        .filter(
          question =>
            !used.has(question.id) &&
            mappings.some(
              mapping =>
                mapping.questionId === question.id && mapping.nodeId === nodeId
            )
        )
        .map(question => ({
          question,
          parameter: parameters.find(
            parameter => parameter.questionId === question.id
          )!,
        }))
        .sort(
          (left, right) =>
            Math.abs(
              predictedProbability(target.theta, left.parameter) - desired
            ) -
            Math.abs(
              predictedProbability(target.theta, right.parameter) - desired
            )
        )[0];
      if (candidate) {
        used.add(candidate.question.id);
        recommendations.push({
          question: candidate.question,
          reason,
          predictedProbability: Number(
            predictedProbability(target.theta, candidate.parameter).toFixed(3)
          ),
          targetNodeId: nodeId,
          targetNodeName:
            nodes.find(item => item.id === nodeId)?.name ?? node.name,
        });
      }
    };
    const upstream = prerequisites.sort(
      (left, right) =>
        (abilityMap.get(left)?.theta ?? 0) - (abilityMap.get(right)?.theta ?? 0)
    )[0];
    if (upstream) choose(upstream, "upstream", 0.72);
    choose(node.id, "weakness", 0.62);
    choose(node.id, "stretch", 0.45);
  }
  const notice = nodes.length
    ? evidence.length
      ? "能力估计仅使用已确认评分；项目参数未手工设置时使用题库难度生成的启发式初值。"
      : "尚无已确认评分：能力参数使用中性先验，推荐依据题库标签与知识依赖，不应视为个人能力结论。"
    : "请先建立知识节点、依赖关系并为题目配置 IRT 参数，才能生成可解释的自适应训练推荐。";
  return {
    nodes,
    edges,
    mappings,
    parameters,
    abilities,
    recommendations: recommendations.slice(0, 6),
    notice,
  };
}
