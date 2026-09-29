/** 欧几里得档案室：差异只用于人工审核，绝不自动确认或覆盖评分档案。 */
import { useEffect, useState } from "react";
import { api, isDesktop } from "@/lib/api";
export function AssessmentDiffPanel({
  current,
  records,
}: {
  current: MyEuclidAssessmentDetail | null;
  records: MyEuclidAssessmentRecord[];
}) {
  const [counterpart, setCounterpart] =
    useState<MyEuclidAssessmentDetail | null>(null);
  useEffect(() => {
    const target = current
      ? records.find(
          item =>
            item.responseId === current.responseId &&
            item.id !== current.id &&
            item.origin !== current.origin
        )
      : undefined;
    if (!target || !isDesktop) {
      setCounterpart(null);
      return;
    }
    api()
      .assessment.getRecord(target.id)
      .then(setCounterpart)
      .catch(() => setCounterpart(null));
  }, [current?.id, records]);
  if (!current) return null;
  if (!counterpart)
    return (
      <section className="assessment-diff">
        <p className="eyebrow">AI / HUMAN REVIEW</p>
        <h4>尚无可对照评分</h4>
        <p>
          请为同一答卷保留 AI
          草案和人工评分。系统只显示差异，绝不自动合并或确认草案。
        </p>
      </section>
    );
  const scoreDelta = current.scoreAwarded - counterpart.scoreAwarded;
  return (
    <section className="assessment-diff">
      <p className="eyebrow">AI / HUMAN REVIEW</p>
      <h4>
        {current.origin === "ai" ? "AI 草案" : "人工评分"}与
        {counterpart.origin === "ai" ? "AI 草案" : "人工评分"}的差异
      </h4>
      <div>
        <strong>
          {current.scoreAwarded} / {current.scoreMaximum}
        </strong>
        <span>
          {scoreDelta === 0
            ? "总分一致"
            : `与对照相差 ${scoreDelta > 0 ? "+" : ""}${scoreDelta} 分`}
        </span>
        <em>
          {current.status === "confirmed"
            ? "当前记录已确认并可进入报告"
            : "当前记录为草案，不进入报告"}
        </em>
      </div>
      <ul>
        {current.evidence.map((item, index) => {
          const other = counterpart.evidence[index];
          const delta = other
            ? item.awardedPoints - other.awardedPoints
            : item.awardedPoints;
          return (
            <li key={item.id}>
              <span>{item.criterion || `依据 ${index + 1}`}</span>
              <b>
                {item.awardedPoints} / {item.maximumPoints}
              </b>
              <small>
                {other
                  ? `对照 ${other.awardedPoints} / ${other.maximumPoints} · 差异 ${delta > 0 ? "+" : ""}${delta}`
                  : "对照记录缺少对应依据"}
              </small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
