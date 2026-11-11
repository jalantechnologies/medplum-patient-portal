import { Block } from "baseui/block";
import { HeadingSmall, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import { FactValue } from "../../components";
import type { Fact } from "../../types";

interface OverviewFactProperties extends Fact {
  label: string;
  testIdentifier: string;
}

const OverviewFact: FC<OverviewFactProperties> = ({
  hasFailed,
  isLoading,
  label,
  testIdentifier,
  value,
}) => (
  <Block display="grid" gridGap="scale300" alignContent="start">
    <ParagraphSmall as="dt" margin="0" color="contentSecondary">
      {label}
    </ParagraphSmall>
    <FactValue
      as="dd"
      hasFailed={hasFailed}
      isLoading={isLoading}
      testIdentifier={testIdentifier}
    >
      <HeadingSmall as="div" margin="0">
        {value}
      </HeadingSmall>
    </FactValue>
  </Block>
);

export default OverviewFact;
