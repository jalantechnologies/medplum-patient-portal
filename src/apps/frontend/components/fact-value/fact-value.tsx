import { Block, type BlockProps } from "baseui/block";
import { ParagraphSmall } from "baseui/typography";
import type { FC, PropsWithChildren } from "react";

import type { Fact } from "../../types";

interface FactValueProperties extends Omit<Fact, "value">, PropsWithChildren {
  as?: BlockProps["as"];
  testIdentifier: string;
}

const FactValue: FC<FactValueProperties> = ({
  as,
  children,
  hasFailed,
  isLoading,
  testIdentifier,
}) => {
  if (isLoading) {
    return (
      <ParagraphSmall
        as={as}
        margin="0"
        color="contentSecondary"
        data-testid={`${testIdentifier}-loading`}
      >
        Loading…
      </ParagraphSmall>
    );
  }
  if (hasFailed) {
    return (
      <ParagraphSmall
        as={as}
        margin="0"
        color="contentSecondary"
        data-testid={`${testIdentifier}-unavailable`}
      >
        Could not load
      </ParagraphSmall>
    );
  }
  return (
    <Block as={as} margin="0" data-testid={testIdentifier}>
      {children}
    </Block>
  );
};

export default FactValue;
