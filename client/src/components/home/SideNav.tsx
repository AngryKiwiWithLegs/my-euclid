/** 左侧导航：英文视图标识承担逻辑，中文文案集中在 navItems 映射。 */
import {
  Archive,
  BookOpenCheck,
  BrainCircuit,
  FileSearch,
  LibraryBig,
  Settings2,
  Target,
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import type { View } from "@/lib/views";

const navItems: { id: View; label: string; icon: typeof Archive }[] = [
  { id: "dashboard", label: "工作台", icon: Archive },
  { id: "library", label: "题库档案", icon: LibraryBig },
  { id: "review", label: "审核工作台", icon: FileSearch },
  { id: "training", label: "训练会话", icon: Target },
  { id: "evidence", label: "错题证据", icon: BookOpenCheck },
  { id: "reports", label: "报告与轨迹", icon: BrainCircuit },
  { id: "ai", label: "AI 服务", icon: Settings2 },
];

export function SideNav({
  active,
  onChange,
}: {
  active: View;
  onChange: (view: View) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <BrandMark className="brand-mark" />
        <div>
          <p className="brand-kicker">PERSONAL MATH ARCHIVE</p>
          <h1>My Euclid</h1>
        </div>
      </div>
      <nav aria-label="主导航" className="primary-nav">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${active === id ? "is-active" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={18} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="local-status">
          <span /> 本地档案模式
        </div>
        <p>
          资料、作答与报告默认保存在本机。AI
          请求仅在你逐次发起，或明确开启自动审核后进行。
        </p>
      </div>
    </aside>
  );
}
