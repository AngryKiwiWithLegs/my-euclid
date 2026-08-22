/**
 * My Euclid 笔迹工作台：温暖档案纸上的克制书写体验。
 * 使用 Pointer Events 保留可回放的归一化笔画，不直接访问本地文件或数据库。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Eraser, Layers3, PenLine, Play, Plus, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import "./InkCanvas.css";

const WIDTH = 900;
const HEIGHT = 560;

type InkPoint = MyEuclidInkPoint;
type InkStroke = MyEuclidInkStroke;
type InkLayer = MyEuclidInkLayer;

interface InkCanvasProps {
  onSave: (payload: { canvasWidth: number; canvasHeight: number; previewSvg: string; layers: InkLayer[] }, status: "draft" | "submitted") => Promise<void>;
  isSaving?: boolean;
}

function cloneLayers(layers: InkLayer[]) { return layers.map(layer => ({ ...layer, strokes: layer.strokes.map(stroke => ({ ...stroke, points: [...stroke.points] })) })); }

function createPreviewSvg(layers: InkLayer[]) {
  const body = layers.filter(layer => layer.visible).flatMap(layer => layer.strokes).map(stroke => {
    if (!stroke.points.length) return "";
    const d = stroke.points.map((point, index) => `${index ? "L" : "M"}${(point.x * WIDTH).toFixed(1)} ${(point.y * HEIGHT).toFixed(1)}`).join(" ");
    return `<path d="${d}" fill="none" stroke="${stroke.tool === "eraser" ? "#fffefa" : stroke.color}" stroke-width="${stroke.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}">${body}</svg>`;
}

function drawStroke(context: CanvasRenderingContext2D, stroke: InkStroke) {
  if (!stroke.points.length) return;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  context.strokeStyle = stroke.color;
  if (stroke.points.length === 1) {
    context.beginPath();
    context.arc(stroke.points[0].x * WIDTH, stroke.points[0].y * HEIGHT, stroke.width / 2, 0, Math.PI * 2);
    context.fillStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : stroke.color;
    context.fill();
  } else {
    for (let index = 1; index < stroke.points.length; index += 1) {
      const previous = stroke.points[index - 1];
      const point = stroke.points[index];
      context.beginPath();
      context.lineWidth = Math.max(1, stroke.width * (0.55 + point.pressure * 0.45));
      context.moveTo(previous.x * WIDTH, previous.y * HEIGHT);
      context.lineTo(point.x * WIDTH, point.y * HEIGHT);
      context.stroke();
    }
  }
  context.restore();
}

export function InkCanvas({ onSave, isSaving = false }: InkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const startedAtRef = useRef(0);
  const [layers, setLayers] = useState<InkLayer[]>([{ title: "主笔迹", ordinal: 1, visible: true, strokes: [] }]);
  const [activeLayer, setActiveLayer] = useState(0);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#163A5F");
  const [width, setWidth] = useState(4);
  const [activeStroke, setActiveStroke] = useState<InkStroke | null>(null);
  const [redoStack, setRedoStack] = useState<InkStroke[]>([]);
  const [replayCount, setReplayCount] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const allStrokes = useMemo(() => layers.filter(layer => layer.visible).flatMap(layer => layer.strokes), [layers]);
  const replayingStrokes = replayCount === null ? allStrokes : allStrokes.slice(0, replayCount);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    replayingStrokes.forEach(stroke => drawStroke(context, stroke));
    if (activeStroke) drawStroke(context, activeStroke);
  }, [activeStroke, replayingStrokes]);

  useEffect(() => {
    if (replayCount === null) return;
    if (replayCount >= allStrokes.length) { const done = window.setTimeout(() => setReplayCount(null), 480); return () => window.clearTimeout(done); }
    const next = window.setTimeout(() => setReplayCount(current => current === null ? null : current + 1), 140);
    return () => window.clearTimeout(next);
  }, [replayCount, allStrokes.length]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>): InkPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)), pressure: event.pressure || 0.5, t: Math.round(performance.now() - startedAtRef.current) };
  };
  const beginStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (replayCount !== null || isSaving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startedAtRef.current = performance.now();
    const stroke: InkStroke = { ordinal: layers[activeLayer]?.strokes.length ?? 0, tool, color, width: tool === "eraser" ? Math.max(width * 4, 18) : width, points: [pointFromEvent(event)] };
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);
    setRedoStack([]);
    setSaved(false);
  };
  const continueStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeStrokeRef.current) return;
    activeStrokeRef.current = { ...activeStrokeRef.current, points: [...activeStrokeRef.current.points, pointFromEvent(event)] };
    setActiveStroke(activeStrokeRef.current);
  };
  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const complete = activeStrokeRef.current;
    if (!complete) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setLayers(current => current.map((layer, index) => index === activeLayer ? { ...layer, strokes: [...layer.strokes, complete] } : layer));
    activeStrokeRef.current = null;
    setActiveStroke(null);
  };
  const undo = () => {
    setLayers(current => current.map((layer, index) => {
      if (index !== activeLayer || !layer.strokes.length) return layer;
      const removed = layer.strokes[layer.strokes.length - 1];
      setRedoStack(stack => [...stack, removed]);
      return { ...layer, strokes: layer.strokes.slice(0, -1) };
    }));
    setSaved(false);
  };
  const redo = () => {
    const stroke = redoStack[redoStack.length - 1];
    if (!stroke) return;
    setLayers(current => current.map((layer, index) => index === activeLayer ? { ...layer, strokes: [...layer.strokes, { ...stroke, ordinal: layer.strokes.length }] } : layer));
    setRedoStack(stack => stack.slice(0, -1));
    setSaved(false);
  };
  const clearLayer = () => { setLayers(current => current.map((layer, index) => index === activeLayer ? { ...layer, strokes: [] } : layer)); setRedoStack([]); setSaved(false); };
  const addLayer = () => { setLayers(current => [...current, { title: `图层 ${current.length + 1}`, ordinal: current.length + 1, visible: true, strokes: [] }]); setActiveLayer(layers.length); };
  const save = async (status: "draft" | "submitted") => { await onSave({ canvasWidth: WIDTH, canvasHeight: HEIGHT, previewSvg: createPreviewSvg(layers), layers: cloneLayers(layers) }, status); setSaved(true); };

  return <section className="ink-workspace"><div className="ink-toolbar"><div className="ink-tool-group"><button className={tool === "pen" ? "is-selected" : ""} onClick={() => setTool("pen")} title="画笔"><PenLine size={15} /> 画笔</button><button className={tool === "eraser" ? "is-selected" : ""} onClick={() => setTool("eraser")} title="橡皮擦"><Eraser size={15} /> 橡皮</button></div><label className="ink-width">笔宽 <input type="range" min="2" max="12" value={width} onChange={event => setWidth(Number(event.target.value))} /></label><div className="ink-colors">{["#163A5F", "#A94132", "#40776B", "#1F2B32"].map(swatch => <button key={swatch} className={color === swatch ? "is-selected" : ""} style={{ backgroundColor: swatch }} onClick={() => setColor(swatch)} aria-label={`选择${swatch}色`} />)}</div></div><div className="ink-canvas-shell"><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="ink-canvas" onPointerDown={beginStroke} onPointerMove={continueStroke} onPointerUp={finishStroke} onPointerCancel={finishStroke} /></div><div className="ink-footer"><div className="ink-layer-tools"><Layers3 size={15} /><select value={activeLayer} onChange={event => setActiveLayer(Number(event.target.value))}>{layers.map((layer, index) => <option value={index} key={`${layer.title}-${index}`}>{layer.title} · {layer.strokes.length} 笔</option>)}</select><button onClick={addLayer} title="新增图层"><Plus size={15} /></button></div><div className="ink-actions"><button onClick={undo} disabled={!layers[activeLayer]?.strokes.length || isSaving}><Undo2 size={15} /> 撤销</button><button onClick={redo} disabled={!redoStack.length || isSaving}><Redo2 size={15} /> 重做</button><button onClick={clearLayer} disabled={!layers[activeLayer]?.strokes.length || isSaving}><RotateCcw size={15} /> 清空</button><button onClick={() => setReplayCount(0)} disabled={!allStrokes.length || replayCount !== null}><Play size={15} /> 回放</button><button className="ink-save" onClick={() => void save("draft")} disabled={!allStrokes.length || isSaving}><Save size={15} /> {isSaving ? "保存中…" : "保存草稿"}</button><button className="ink-submit" onClick={() => void save("submitted")} disabled={!allStrokes.length || isSaving}><CheckCircle2 size={15} /> 提交笔迹</button></div></div><p className="ink-caption">{saved ? <><CheckCircle2 size={14} /> 当前笔迹版本已存入本地档案；回放会按原始笔画顺序重建。</> : "笔迹在当前画布中编辑；保存后会作为独立答卷版本进入本地备份。"}</p></section>;
}
