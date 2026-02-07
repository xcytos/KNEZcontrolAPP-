import { Component, ErrorInfo, ReactNode } from "react";

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
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleRestart = () => {
    // Hard Reset: Clear all local storage and reload
    localStorage.clear();
    sessionStorage.clear();
    // We cannot easily clear AppLocalData from here without FS access which might be broken,
    // but clearing localStorage usually fixes "stale state" issues in React apps.
    
    // Force reload ignoring cache
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-300 p-8">
          <div className="max-w-md w-full bg-zinc-900 border border-red-900/50 rounded-lg p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <span className="text-2xl">⚠</span>
              <h1 className="text-xl font-bold">System Failure</h1>
            </div>
            
            <p className="text-sm text-zinc-400 mb-6">
              The Control App has encountered a critical error and must stop. 
              This is a safety mechanism to prevent undefined behavior.
            </p>

            <div className="bg-black/50 rounded p-4 mb-6 font-mono text-[10px] text-red-300 overflow-x-auto">
              <div className="mb-2 font-bold text-zinc-500 uppercase">Diagnostics</div>
              {this.state.error?.toString()}
            </div>

            <button
              onClick={this.handleRestart}
              className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded font-medium transition-colors"
            >
              Factory Reset & Restart
            </button>
            
            <p className="mt-4 text-[10px] text-zinc-600 text-center">
               Action will clear local session cache.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
