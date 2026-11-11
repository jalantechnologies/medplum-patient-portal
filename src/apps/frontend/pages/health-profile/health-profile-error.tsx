import { Banner, KIND } from "baseui/banner";
import { Block } from "baseui/block";
import type { FC } from "react";

interface HealthProfileErrorProperties {
  message: string;
  onRetry: () => void;
}

const HealthProfileError: FC<HealthProfileErrorProperties> = ({
  message,
  onRetry,
}) => (
  <Block role="alert" data-testid="health-profile-error">
    <Banner
      kind={KIND.negative}
      action={{ label: "Try again", onClick: onRetry }}
      overrides={{
        Root: { props: { "aria-label": "Health profile error" } },
        TrailingButtonContainer: {
          props: { "data-testid": "health-profile-retry" },
        },
      }}
    >
      {message}
    </Banner>
  </Block>
);

export default HealthProfileError;
