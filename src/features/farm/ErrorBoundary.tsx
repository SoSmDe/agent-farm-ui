/**
 * ErrorBoundary — Catches React rendering errors and shows fallback UI.
 * Prevents one broken component from crashing the entire dashboard.
 */

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="text-2xl mb-2">&#x26A0;</div>
            <p className="text-sm font-medium text-foreground mb-1">
              {this.props.label ? `${this.props.label} error` : "Something went wrong"}
            </p>
            <p className="text-[0.733rem] text-muted-foreground/60 mb-3">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-[0.733rem] text-primary hover:text-primary/80 px-3 py-1.5 rounded border border-primary/20 hover:border-primary/40 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
