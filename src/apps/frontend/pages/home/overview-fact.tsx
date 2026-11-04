import { Block } from "baseui/block";
import { HeadingSmall, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

interface OverviewFactProperties {
  hasFailed: boolean;
  isLoading: boolean;
  label: string;
  testIdentifier: string;
  value: string;
}

const OverviewFactValue: FC<Omit<OverviewFactProperties, "label">> = ({
  hasFailed,
  isLoading,
  testIdentifier,
  value,
}) => {
  if (isLoading) {
    return (
      <ParagraphSmall
        as="dd"
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
        as="dd"
        margin="0"
        color="contentSecondary"
        data-testid={`${testIdentifier}-unavailable`}
      >
        Could not load
      </ParagraphSmall>
    );
  }
  return (
    <HeadingSmall as="dd" margin="0" data-testid={testIdentifier}>
      {value}
    </HeadingSmall>
  );
};

const OverviewFact: FC<OverviewFactProperties> = ({
  label,
  ...valueProperties
}) => (
  <Block display="grid" gridGap="scale300" alignContent="start">
    <ParagraphSmall as="dt" margin="0" color="contentSecondary">
      {label}
    </ParagraphSmall>
    <OverviewFactValue {...valueProperties} />
  </Block>
);

export default OverviewFact;
