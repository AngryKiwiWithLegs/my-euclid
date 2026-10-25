/**
 * 数学文本渲染：将题面中的 LaTeX 片段（$...$、$$...$$、\(...\)、\[...\]）
 * 用 KaTeX 渲染为公式；无公式或渲染失败时原样返回纯文本，不丢内容。
 */
import katex from "katex";
import { useMemo } from "react";
import "katex/dist/katex.min.css";

const MATH_SEGMENTS =
  /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g;

function renderSegment(segment: string): string {
  const isBlock = segment.startsWith("$$") || segment.startsWith("\\[");
  const source = segment.slice(2, segment.length - (isBlock ? 2 : 1)).trim();
  try {
    return katex.renderToString(source, {
      displayMode: isBlock,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return segment;
  }
}

function renderMathHtml(text: string): string {
  return text
    .split(MATH_SEGMENTS)
    .map((segment, index) =>
      index % 2 === 1
        ? renderSegment(segment)
        : segment
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
    )
    .join("");
}

export function MathText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => renderMathHtml(text), [text]);
  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
