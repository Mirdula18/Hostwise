import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";

type Props = { children: ReactNode; resetKey?: string };
type State = { failed: boolean };

/** Keeps one broken route from taking down the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Errors are shown to the user; nothing is logged or sent anywhere.
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.failed && prev.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-danger bg-surface p-4">
        <h2 className="text-lg font-bold">Something went wrong on this page.</h2>
        <p>Your saved events are safe. Try again, or go back to your events.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => this.setState({ failed: false })}>Try again</Button>
          <a
            className="inline-flex min-h-11 items-center px-2 font-semibold text-brand underline"
            href="/"
          >
            Go to my events
          </a>
        </div>
      </div>
    );
  }
}
