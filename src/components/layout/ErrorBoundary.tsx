import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-zinc-950 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center mb-6">
            <span className="text-3xl text-red-500">⚠</span>
          </div>
          <h1 className="text-xl font-medium text-zinc-200 mb-2">System Failure</h1>
          <p className="text-zinc-500 max-w-md mb-8">
            The Control App has encountered a critical error and must stop. 
            This is a safety mechanism to prevent undefined behavior.
          </p>
          
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-left overflow-auto max-h-64">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Diagnostics</h3>
            <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">
              {this.state.error?.toString()}
            </pre>
          </div>

          <button 
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-sm transition-colors border border-zinc-700"
          >
            Restart System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
