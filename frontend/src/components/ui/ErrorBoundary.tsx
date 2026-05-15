import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; message: string; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center min-h-[120px] rounded-xl border border-red/20 bg-red/5 p-4">
          <p className="text-sm text-red/70">Component failed to load — {this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
