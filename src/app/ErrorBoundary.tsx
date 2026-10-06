import { Component } from "react";
import type { ReactNode } from "react";
import { friendlyError } from "@/lib/errors";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
            <p className="text-4xl">⚠️</p>
            <h1 className="mt-2 text-lg font-bold">Terjadi kesalahan</h1>
            <p className="mt-1 text-sm text-muted">
              {friendlyError(this.state.error, "Terjadi kesalahan. Coba muat ulang halaman ya.")}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 h-10 rounded-lg bg-primary px-6 text-sm font-medium"
            >
              Muat ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
