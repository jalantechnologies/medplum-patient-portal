import type { PropsWithChildren } from "react";
import { useLocation, useNavigate } from "react-router";

import { ErrorMessage } from "../../components";

interface PageErrorProperties {
  isRetryFocused?: boolean;
}

export default function PageError({
  children,
  isRetryFocused = false,
}: PropsWithChildren<PageErrorProperties>) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ErrorMessage
      isRetryFocused={isRetryFocused}
      onRetry={() =>
        navigate(location, { replace: true, state: location.state })
      }
    >
      {children}
    </ErrorMessage>
  );
}
