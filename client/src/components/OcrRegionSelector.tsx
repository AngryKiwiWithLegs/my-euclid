/**
 * 欧几里得档案室：页面级视觉审核组件。
 * 保持原件可见、框选边界克制，并让 OCR 文本只能由人工明确采用。
 */
import {
  MousePointer2,
  RotateCcw,
  ScanLine,
  TextCursorInput,
} from "lucide-react";
import { useState } from "react";
import "./OcrRegionSelector.css";

type Point = { x: number; y: number };

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function fromPoints(start: Point, end: Point): MyEuclidNormalizedRect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function OcrRegionSelector({
  preview,
  regions,
  isBusy,
  onRecognize,
  onUseText,
}: {
  preview: MyEuclidReviewPagePreview | null;
  regions: MyEuclidOcrRegion[];
  isBusy: boolean;
  onRecognize: (rect: MyEuclidNormalizedRect) => Promise<void>;
  onUseText: (text: string) => void;
}) {
  const [start, setStart] = useState<Point | null>(null);
  const [selection, setSelection] = useState<MyEuclidNormalizedRect | null>(
    null
  );
  const pointAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    };
  };
  const begin = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!preview?.available || isBusy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = pointAt(event);
    setStart(next);
    setSelection({ x: next.x, y: next.y, width: 0, height: 0 });
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (start) setSelection(fromPoints(start, pointAt(event)));
  };
  const complete = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const next = fromPoints(start, pointAt(event));
    setStart(null);
    setSelection(next.width >= 0.015 && next.height >= 0.015 ? next : null);
  };
  if (!preview)
    return <div className="page-preview-loading">正在生成本地页图…</div>;
  if (!preview.available || !preview.dataUrl)
    return (
      <div className="page-preview-unavailable">
        <TextCursorInput size={20} />
        <span>
          <strong>当前页面不可视化预览</strong>
          <small>{preview.reason ?? "页面图像尚不可用。"}</small>
        </span>
      </div>
    );
  return (
    <div className="ocr-region-selector">
      <div className="ocr-region-toolbar">
        <span>
          <MousePointer2 size={14} /> 在页面上拖拽框选需要重新识别的区域
        </span>
        <button
          type="button"
          onClick={() => setSelection(null)}
          disabled={!selection || isBusy}
        >
          <RotateCcw size={13} /> 重置框选
        </button>
      </div>
      <div
        className="page-preview-stage"
        style={{
          aspectRatio: `${preview.width ?? 1} / ${preview.height ?? 1}`,
        }}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={complete}
        onPointerCancel={() => {
          setStart(null);
          setSelection(null);
        }}
      >
        <img
          src={preview.dataUrl}
          alt={`第 ${preview.pageNumber} 页本地预览`}
          draggable={false}
        />
        {regions.map((region, index) => (
          <span
            className="persisted-region"
            key={region.id}
            style={{
              left: `${region.rect.x * 100}%`,
              top: `${region.rect.y * 100}%`,
              width: `${region.rect.width * 100}%`,
              height: `${region.rect.height * 100}%`,
            }}
            aria-label={`已识别区域 ${index + 1}`}
          >
            <i>{index + 1}</i>
          </span>
        ))}
        {selection && (
          <span
            className="draft-region"
            style={{
              left: `${selection.x * 100}%`,
              top: `${selection.y * 100}%`,
              width: `${selection.width * 100}%`,
              height: `${selection.height * 100}%`,
            }}
          />
        )}
      </div>
      <div className="ocr-region-actions">
        <small>
          {selection
            ? `已选 ${(selection.width * 100).toFixed(0)}% × ${(selection.height * 100).toFixed(0)}% 的原页区域`
            : "尚未框选区域"}
        </small>
        <button
          type="button"
          className="secondary-button"
          disabled={!selection || isBusy}
          onClick={() => selection && void onRecognize(selection)}
        >
          <ScanLine size={14} /> {isBusy ? "正在本地识别…" : "识别所选区域"}
        </button>
      </div>
      {regions.length > 0 && (
        <div className="ocr-region-history">
          <p className="eyebrow">REGION OCR HISTORY · {regions.length}</p>
          {regions.slice(0, 4).map((region, index) => (
            <article key={region.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>
                {region.ocrStatus === "failed"
                  ? "本次局部识别未完成。"
                  : region.ocrText || "未提取到可编辑文本。"}
              </p>
              <button
                type="button"
                onClick={() => onUseText(region.ocrText)}
                disabled={!region.ocrText}
              >
                <TextCursorInput size={13} /> 采用文本
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
