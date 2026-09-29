/** 欧几里得档案室：报告页装饰——细密坐标网格 + 标尺刻度。
 *  对应 ideas.md 中的 "报告页中使用细密坐标网格、标尺刻度和可追溯来源脚注"。 */
export function ReportDecor({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 240 220"
      role="img"
      aria-label="数学报告材料装饰"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern
          id="report-grid"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 12 0 L 0 0 0 12"
            fill="none"
            stroke="currentColor"
            stroke-width="0.5"
            opacity="0.45"
          />
        </pattern>
      </defs>
      <rect width="240" height="220" fill="url(#report-grid)" />
      <g fill="none" stroke="currentColor" stroke-linecap="round">
        <path d="M 8 196 L 232 196" stroke-width="0.9" opacity="0.7" />
        <path d="M 8 8 L 8 196" stroke-width="0.9" opacity="0.7" />
        <g stroke-width="0.6" opacity="0.55">
          <path d="M 24 192 L 24 200" />
          <path d="M 48 192 L 48 200" />
          <path d="M 72 192 L 72 200" />
          <path d="M 96 192 L 96 200" />
          <path d="M 120 192 L 120 200" />
          <path d="M 144 192 L 144 200" />
          <path d="M 168 192 L 168 200" />
          <path d="M 192 192 L 192 200" />
          <path d="M 216 192 L 216 200" />
        </g>
      </g>
      <path
        d="M 16 168 C 56 150 84 132 116 110 S 184 70 224 36"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-dasharray="3 3"
        opacity="0.7"
      />
      <circle cx="116" cy="110" r="2.2" fill="currentColor" />
    </svg>
  );
}
