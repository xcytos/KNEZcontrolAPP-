import { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "../../services/utils/LogService";

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: "connection" | "render" | "runtime" | "unknown";
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorType: "unknown",
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Classify error type
    let errorType: "connection" | "render" | "runtime" | "unknown" = "unknown";
    
    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || "";
    
    if (errorMessage.includes("network") || 
        errorMessage.includes("fetch") || 
        errorMessage.includes("connection") ||
        errorMessage.includes("timeout") ||
        errorStack.includes("fetch") ||
        errorStack.includes("xhr")) {
      errorType = "connection";
    } else if (errorMessage.includes("render") || errorStack.includes("react")) {
      errorType = "render";
    } else if (errorMessage.includes("runtime") || errorMessage.includes("typeerror")) {
      errorType = "runtime";
    }
    
    return { hasError: true, error, errorType };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("error_boundary", "component_did_catch", {
      error: error.message,
      errorType: this.state.errorType,
      componentStack: errorInfo.componentStack,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorType: "unknown",
      retryCount: prevState.retryCount + 1,
    }));
  };

  private handleRestart = () => {
    // Hard Reset: Clear all local storage and reload
    localStorage.clear();
    sessionStorage.clear();
    
    // Force reload ignoring cache
    window.location.reload();
  };

  private getErrorMessage = () => {
    switch (this.state.errorType) {
      case "connection":
        return "Unable to connect to the backend service. Please check your connection and try again.";
      case "render":
        return "A rendering error occurred. This may be due to a UI component issue.";
      case "runtime":
        return "A runtime error occurred during execution.";
      default:
        return "An unexpected error occurred.";
    }
  };

  private getErrorIcon = () => {
    switch (this.state.errorType) {
      case "connection":
        return "🔌";
      case "render":
        return "⚛️";
      case "runtime":
        return "⚡";
      default:
        return "⚠️";
    }
  };

  private getErrorColor = () => {
    switch (this.state.errorType) {
      case "connection":
        return "text-yellow-500 border-yellow-900/50 bg-yellow-900/10";
      case "render":
        return "text-purple-500 border-purple-900/50 bg-purple-900/10";
      case "runtime":
        return "text-orange-500 border-orange-900/50 bg-orange-900/10";
      default:
        return "text-red-500 border-red-900/50 bg-red-900/10";
    }
  };

  public render() {
    if (this.state.hasError) {
      const errorColor = this.getErrorColor();
      
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-300 p-8">
          <div className={`max-w-md w-full bg-zinc-900 border rounded-lg p-6 shadow-2xl ${errorColor}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{this.getErrorIcon()}</span>
              <h1 className="text-xl font-bold">
                {this.state.errorType === "connection" ? "Connection Error" : "System Error"}
              </h1>
            </div>
            
            <p className="text-sm text-zinc-400 mb-6">
              {this.getErrorMessage()}
            </p>

            <div className="bg-black/50 rounded p-4 mb-6 font-mono text-[10px] text-red-300 overflow-x-auto">
              <div className="mb-2 font-bold text-zinc-500 uppercase">Error Details</div>
              <div className="break-all">{this.state.error?.toString()}</div>
            </div>

            <div className="space-y-2">
              {this.state.errorType === "connection" && this.state.retryCount < 3 && (
                <button
                  onClick={this.handleRetry}
                  className="w-full py-3 bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 border border-blue-900/50 rounded font-medium transition-colors"
                >
                  Retry ({this.state.retryCount}/3)
                </button>
              )}
              
              <button
                onClick={this.handleRestart}
                className="w-full py-3 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded font-medium transition-colors"
              >
                Factory Reset & Restart
              </button>
            </div>
            
            <p className="mt-4 text-[10px] text-zinc-600 text-center">
               Factory reset will clear local session cache.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
