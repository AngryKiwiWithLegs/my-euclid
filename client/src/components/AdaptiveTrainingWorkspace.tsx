/** 欧几里得档案室：自适应训练只使用已确认评分，未有证据时明确展示中性先验而非伪造能力结论。 */
import {
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  CirclePlus,
  GitBranch,
  SlidersHorizontal,
  Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, isDesktop } from "@/lib/api";
import "./AdaptiveTrainingWorkspace.css";
import { useNotify } from "@/lib/toast";

const reasonText = {
  upstream: "先补上游依赖",
  weakness: "针对当前弱点",
  stretch: "向高难迁移",
  review: "巩固复盘",
};

export function AdaptiveTrainingWorkspace({
  backToSingle,
  openQuestion,
}: {
  backToSingle: () => void;
  openQuestion: (id: string) => void;
}) {
  const notify = useNotify();
  const [profile, setProfile] = useState<MyEuclidAdaptiveProfile | null>(null);
  const [questions, setQuestions] = useState<MyEuclidQuestionBankQuestion[]>(
    []
  );
  const [nodeName, setNodeName] = useState("");
  const [nodeDescription, setNodeDescription] = useState("");
  const [edgeFrom, setEdgeFrom] = useState("");
  const [edgeTo, setEdgeTo] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [nodeIds, setNodeIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState(0);
  const [discrimination, setDiscrimination] = useState(1);
  const [guessing, setGuessing] = useState(0);
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    if (!isDesktop) return;
    try {
      const [nextProfile, nextQuestions] = await Promise.all([
        api().adaptive.getProfile(),
        api().library.listQuestions({ limit: 500 }),
      ]);
      setProfile(nextProfile);
      setQuestions(nextQuestions);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "无法读取本地自适应训练档案。"
      );
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!edgeFrom && profile?.nodes[0]) setEdgeFrom(profile.nodes[0].id);
    if (!edgeTo && profile?.nodes[1]) setEdgeTo(profile.nodes[1].id);
  }, [profile, edgeFrom, edgeTo]);
  const abilities = useMemo(
    () => new Map(profile?.abilities.map(item => [item.nodeId, item]) ?? []),
    [profile]
  );
  const addNode = async () => {
    if (!isDesktop || !nodeName.trim()) return;
    try {
      setBusy(true);
      await api().adaptive.saveNode({
        name: nodeName,
        description: nodeDescription,
      });
      setNodeName("");
      setNodeDescription("");
      await refresh();
      notify("知识节点已写入本地依赖图谱。");
    } catch (error) {
      notify(error instanceof Error ? error.message : "知识节点保存失败。");
    } finally {
      setBusy(false);
    }
  };
  const addEdge = async () => {
    if (!isDesktop || !edgeFrom || !edgeTo) return;
    try {
      setBusy(true);
      await api().adaptive.saveEdge({
        prerequisiteNodeId: edgeFrom,
        dependentNodeId: edgeTo,
        strength: 1,
      });
      await refresh();
      notify("知识依赖已保存：先修节点会在推荐中优先出现。");
    } catch (error) {
      notify(error instanceof Error ? error.message : "知识依赖保存失败。");
    } finally {
      setBusy(false);
    }
  };
  const saveParameter = async () => {
    if (!isDesktop || !questionId || !nodeIds.length) return;
    try {
      setBusy(true);
      await api().adaptive.saveItemParameter({
        questionId,
        difficulty,
        discrimination,
        guessing,
        source: "manual",
        nodeIds,
      });
      await refresh();
      notify("题目 IRT 参数与知识映射已保存。");
    } catch (error) {
      notify(error instanceof Error ? error.message : "IRT 参数保存失败。");
    } finally {
      setBusy(false);
    }
  };
  if (!isDesktop)
    return (
      <div className="view-shell">
        <div className="review-empty">
          <BrainCircuit size={32} />
          <h3>浏览器预览不计算个人能力。</h3>
          <p>
            知识图谱、IRT 参数与能力快照仅在桌面端本地 SQLite
            中计算；浏览器不会读取训练证据。
          </p>
        </div>
      </div>
    );
  return (
    <div className="view-shell adaptive-view">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DEPENDENCY GRAPH · IRT ADAPTIVE TRAINING</p>
          <h3>深度专项训练</h3>
        </div>
        <button className="text-action" onClick={backToSingle}>
          返回单题训练
        </button>
      </div>
      <div className="adaptive-notice">
        <Target size={18} />
        <p>{profile?.notice ?? "正在读取本地能力证据…"}</p>
      </div>
      <div className="adaptive-grid">
        <section className="adaptive-card graph-card">
          <div className="adaptive-card-head">
            <div>
              <p className="eyebrow">KNOWLEDGE DEPENDENCIES</p>
              <h4>知识依赖图谱</h4>
            </div>
            <GitBranch size={18} />
          </div>
          <div className="node-list">
            {profile?.nodes.length ? (
              profile.nodes.map(node => {
                const ability = abilities.get(node.id);
                return (
                  <article key={node.id}>
                    <div>
                      <strong>{node.name}</strong>
                      <small>{node.description || "未填写节点说明"}</small>
                    </div>
                    <span
                      className={ability?.evidenceCount ? "is-evidenced" : ""}
                    >
                      {ability?.evidenceCount
                        ? `θ ${ability.theta.toFixed(2)} · ${ability.evidenceCount} 条证据`
                        : "中性先验"}
                    </span>
                  </article>
                );
              })
            ) : (
              <p className="adaptive-empty">
                先建立知识节点，例如“递推关系”“不变量”“数学归纳法”。
              </p>
            )}
          </div>
          <div className="edge-list">
            {profile?.edges.length ? (
              profile.edges.map(edge => (
                <div key={edge.id}>
                  <span>
                    {profile.nodes.find(
                      node => node.id === edge.prerequisiteNodeId
                    )?.name ?? "未知节点"}
                  </span>
                  <ArrowRight size={14} />
                  <strong>
                    {profile.nodes.find(
                      node => node.id === edge.dependentNodeId
                    )?.name ?? "未知节点"}
                  </strong>
                </div>
              ))
            ) : (
              <small>
                尚未配置依赖关系。依赖用于在弱点出现前优先推荐上游补弱题。
              </small>
            )}
          </div>
          <div className="node-form">
            <input
              value={nodeName}
              onChange={event => setNodeName(event.target.value)}
              placeholder="新增知识节点名称"
            />
            <input
              value={nodeDescription}
              onChange={event => setNodeDescription(event.target.value)}
              placeholder="节点说明（可选）"
            />
            <button
              className="secondary-button"
              disabled={busy || !nodeName.trim()}
              onClick={() => void addNode()}
            >
              <CirclePlus size={14} /> 新增节点
            </button>
          </div>
          {(profile?.nodes.length ?? 0) >= 2 && (
            <div className="edge-form">
              <select
                value={edgeFrom}
                onChange={event => setEdgeFrom(event.target.value)}
              >
                {profile!.nodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
              <ArrowRight size={14} />
              <select
                value={edgeTo}
                onChange={event => setEdgeTo(event.target.value)}
              >
                {profile!.nodes.map(node => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))}
              </select>
              <button
                className="secondary-button"
                disabled={busy || edgeFrom === edgeTo}
                onClick={() => void addEdge()}
              >
                建立依赖
              </button>
            </div>
          )}
        </section>
        <section className="adaptive-card parameter-card">
          <div className="adaptive-card-head">
            <div>
              <p className="eyebrow">ITEM RESPONSE MODEL</p>
              <h4>题目项目参数</h4>
            </div>
            <SlidersHorizontal size={18} />
          </div>
          <p className="adaptive-copy">
            将已发布题目关联到知识节点。未手工设置时，系统仅以题库难度生成启发式初值，并在界面中明确标注。
          </p>
          <label>
            题目
            <select
              value={questionId}
              onChange={event => setQuestionId(event.target.value)}
            >
              <option value="">选择已发布题目</option>
              {questions.map(question => (
                <option key={question.id} value={question.id}>
                  {question.sourceName} · {question.label} · {question.title}
                </option>
              ))}
            </select>
          </label>
          <div className="parameter-inputs">
            <label>
              难度 b
              <input
                type="number"
                min="-4"
                max="4"
                step="0.1"
                value={difficulty}
                onChange={event => setDifficulty(Number(event.target.value))}
              />
            </label>
            <label>
              区分度 a
              <input
                type="number"
                min="0.1"
                max="4"
                step="0.1"
                value={discrimination}
                onChange={event =>
                  setDiscrimination(Number(event.target.value))
                }
              />
            </label>
            <label>
              猜测 c
              <input
                type="number"
                min="0"
                max="0.49"
                step="0.01"
                value={guessing}
                onChange={event => setGuessing(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="mapping-list">
            <strong>知识映射（至少一项）</strong>
            {profile?.nodes.map(node => (
              <label key={node.id}>
                <input
                  type="checkbox"
                  checked={nodeIds.includes(node.id)}
                  onChange={() =>
                    setNodeIds(current =>
                      current.includes(node.id)
                        ? current.filter(id => id !== node.id)
                        : [...current, node.id]
                    )
                  }
                />{" "}
                {node.name}
              </label>
            ))}
          </div>
          <button
            className="primary-button wide-button"
            disabled={busy || !questionId || !nodeIds.length}
            onClick={() => void saveParameter()}
          >
            保存 IRT 参数与映射
          </button>
        </section>
      </div>
      <section className="adaptive-card recommendation-card">
        <div className="adaptive-card-head">
          <div>
            <p className="eyebrow">NEXT BEST TRAINING</p>
            <h4>定点爆破建议</h4>
          </div>
          <BrainCircuit size={18} />
        </div>
        {profile?.recommendations.length ? (
          <div className="recommendation-list">
            {profile.recommendations.map((item, index) => (
              <article key={`${item.question.id}-${item.reason}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p>
                    {reasonText[item.reason]} · {item.targetNodeName}
                  </p>
                  <h5>
                    {item.question.sourceName} · {item.question.label} ·{" "}
                    {item.question.title}
                  </h5>
                  <small>
                    预测正确率 {Math.round(item.predictedProbability * 100)}% ·{" "}
                    {item.question.primaryTopic} · 难度{" "}
                    {item.question.difficulty ?? "—"}/5
                  </small>
                </div>
                <button
                  className="row-action"
                  onClick={() => openQuestion(item.question.id)}
                >
                  训练 <ChevronRight size={15} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="adaptive-empty">
            <Target size={24} />
            <p>
              完成知识节点、题目映射和至少一份已确认评分后，这里会按“上游补弱—当前巩固—高难迁移”生成可解释推荐。
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
