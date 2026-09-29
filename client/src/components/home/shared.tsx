/** 首页共享小部件：区块标题与指标卡。 */
export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
      {action}
    </div>
  );
}

export function Metric({
  number,
  label,
  note,
}: {
  number: string;
  label: string;
  note: string;
}) {
  return (
    <div className="metric">
      <strong>{number}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </div>
  );
}
