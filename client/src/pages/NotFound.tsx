/** 404 页：与档案工作台一致的纸张风格，中文文案。 */
import { Archive, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="error-screen">
      <div className="error-card">
        <Archive size={34} />
        <h1>404</h1>
        <h2>页面不存在</h2>
        <p>你要找的页面可能已被移动或删除。</p>
        <button className="primary-button" onClick={() => setLocation("/")}>
          <ArrowLeft size={15} /> 返回工作台
        </button>
      </div>
    </div>
  );
}
