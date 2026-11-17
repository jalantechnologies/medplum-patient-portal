import { Block } from "baseui/block";
import { HeadingSmall, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import { FactValue, RecordRow } from "../../components";
import type { CarePlanSummary } from "./care-plan-summary";

interface CurrentCareProperties {
  carePlans: CarePlanSummary[];
  hasFailed: boolean;
  isLoading: boolean;
}

const CurrentCare: FC<CurrentCareProperties> = ({
  carePlans,
  hasFailed,
  isLoading,
}) => (
  <Block
    as="section"
    aria-labelledby="current-care-heading"
    data-testid="current-care-section"
  >
    <HeadingSmall
      as="h2"
      id="current-care-heading"
      marginTop="0"
      marginBottom="scale300"
    >
      Current care
    </HeadingSmall>
    <FactValue
      hasFailed={hasFailed}
      isLoading={isLoading}
      testIdentifier="current-care"
    >
      {carePlans.length > 0 ? (
        <Block as="ul" margin="0" padding="0" data-testid="current-care-list">
          {carePlans.map((carePlan) => (
            <RecordRow
              key={carePlan.identifier}
              author={carePlan.author}
              date={carePlan.date}
              source={carePlan.source}
              status={carePlan.status}
              testIdentifier="current-care-plan"
              title={carePlan.title}
            />
          ))}
        </Block>
      ) : (
        <ParagraphSmall
          margin="0"
          color="contentSecondary"
          data-testid="current-care-empty"
        >
          No care plans available
        </ParagraphSmall>
      )}
    </FactValue>
  </Block>
);

export default CurrentCare;
