import { Component, type PropsWithChildren } from "react";

import ErrorMessage from "../error-message/error-message";
import ErrorScreen from "../error-screen/error-screen";

interface ApplicationErrorBoundaryState {
  hasFailed: boolean;
}

const loadPageAgain = () => window.location.reload();

export default class ApplicationErrorBoundary extends Component<
  PropsWithChildren,
  ApplicationErrorBoundaryState
> {
  state: ApplicationErrorBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): ApplicationErrorBoundaryState {
    return { hasFailed: true };
  }

  render() {
    if (!this.state.hasFailed) {
      return this.props.children;
    }
    return (
      <ErrorScreen>
        <ErrorMessage isRetryFocused onRetry={loadPageAgain} />
      </ErrorScreen>
    );
  }
}
