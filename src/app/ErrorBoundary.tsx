import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/** Ловит падение одной части интерфейса, не давая ему уронить всё приложение. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('UI error', error, info.componentStack)
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm">
          <p className="font-medium">Этот блок не смог отобразиться</p>
          <p className="max-w-md font-mono text-xs text-zinc-500">{this.state.error.message}</p>
          <button
            type="button"
            className="rounded border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            onClick={() => {
              this.setState({ error: null })
            }}
          >
            Попробовать снова
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
