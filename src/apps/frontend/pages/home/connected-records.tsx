import { formatDateTime } from "@medplum/core";
import { Block } from "baseui/block";
import { HeadingSmall, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import { FactValue } from "../../components";
import constant from "../../constants";
import { DATE_FORMAT } from "../../constants/date-format";
import type { Nullable } from "../../types";

interface ConnectedRecordsProperties {
  hasFailed: boolean;
  isLoading: boolean;
  lastReceived: Nullable<string>;
}

const describeLastReceived = (lastReceived: Nullable<string>): string => {
  const day =
    lastReceived &&
    formatDateTime(lastReceived, constant.LOCALE, DATE_FORMAT.SHORT_DAY);
  return day
    ? `Received ${day}. This may not be a complete or current record.`
    : "No records received yet.";
};

const ConnectedRecords: FC<ConnectedRecordsProperties> = ({
  hasFailed,
  isLoading,
  lastReceived,
}) => (
  <Block
    as="section"
    aria-labelledby="connected-records-heading"
    data-testid="connected-records-section"
  >
    <HeadingSmall
      as="h2"
      id="connected-records-heading"
      marginTop="0"
      marginBottom="scale600"
    >
      Connected records
    </HeadingSmall>
    <ParagraphSmall
      marginTop="0"
      marginBottom="scale600"
      color="contentSecondary"
    >
      Available records from participating sources.
    </ParagraphSmall>
    <FactValue
      hasFailed={hasFailed}
      isLoading={isLoading}
      testIdentifier="last-received"
    >
      <ParagraphSmall margin="0" color="contentSecondary">
        {describeLastReceived(lastReceived)}
      </ParagraphSmall>
    </FactValue>
  </Block>
);

export default ConnectedRecords;
