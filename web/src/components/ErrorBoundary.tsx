import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./ui/States";

interface ErrorBoundaryState {
  error: Error | null;
}

/** Catches render errors per route so one broken panel cannot blank the app. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the dev console only; production shows the retry panel.
    if (import.meta.env.DEV) {
      console.error("[Agentic-mesh] render error", error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="This view crashed"
          message={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
