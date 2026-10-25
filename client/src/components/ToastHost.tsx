/** 全局 toast 宿主：唯一订阅通知状态的组件。 */
import { GraduationCap } from "lucide-react";
import { useToastStore } from "@/lib/toast";

export function ToastHost() {
  const message = useToastStore(state => state.message);
  if (!message) return null;
  return (
    <div className="toast" role="status">
      <GraduationCap size={17} /> {message}
    </div>
  );
}
