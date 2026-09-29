/** 欧几里得档案室：作品起点——两条弧线相交于一点的几何构图。
 *  对应 ideas.md 中的 "作图起点" 标志描述。颜色用档案深蓝（Archive Navy）。 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 38 38"
      role="img"
      aria-label="My Euclid 抽象作图标志"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.6"
      >
        <path d="M 5 19 A 14 14 0 0 1 33 19" />
        <path d="M 19 5 A 14 14 0 0 1 19 33" opacity="0.55" />
      </g>
      <circle cx="19" cy="19" r="1.8" fill="currentColor" />
    </svg>
  );
}
