/** 全局错误边界：档案纸风格，中文文案，提供错误堆栈与重载入口。 */
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <div className="error-card">
            <AlertTriangle size={34} />
            <h2>发生了意外错误</h2>
            <div className="error-stack">
              <pre>{this.state.error?.stack}</pre>
            </div>
            <button
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={15} /> 重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
