import { Block } from "baseui/block";
import {
  Button,
  KIND as BUTTON_KIND,
  SIZE as BUTTON_SIZE,
} from "baseui/button";
import { StyledDivider } from "baseui/divider";
import { Tag, KIND as TAG_KIND, SIZE as TAG_SIZE } from "baseui/tag";
import {
  LabelMedium,
  ParagraphSmall,
  ParagraphXSmall,
} from "baseui/typography";
import type { FC } from "react";

import { RecordListTabContent } from "../../components";
import type { RecordListTab } from "../../types";
import type { HealthRecordSummary } from "./health-record-summary";

interface HealthRecordListProperties {
  onViewRecord: (record: HealthRecordSummary) => void;
  tab: RecordListTab<HealthRecordSummary>;
}

interface HealthRecordRowProperties {
  onViewRecord: (record: HealthRecordSummary) => void;
  record: HealthRecordSummary;
  testIdentifier: string;
}

const HealthRecordRow: FC<HealthRecordRowProperties> = ({
  onViewRecord,
  record,
  testIdentifier,
}) => (
  <Block as="li" display="block" data-testid={testIdentifier}>
    <Block
      display="flex"
      flexDirection={["column", "column", "row"]}
      alignItems={["flex-start", "flex-start", "center"]}
      justifyContent="space-between"
      gridGap="scale600"
      paddingTop="scale600"
      paddingBottom="scale700"
    >
      <Block display="grid" gridGap="scale100">
        <LabelMedium>{record.title}</LabelMedium>
        {record.date ? (
          <ParagraphSmall margin="0" color="contentSecondary">
            {record.date}
          </ParagraphSmall>
        ) : null}
        {record.author ? (
          <ParagraphXSmall margin="0" color="contentTertiary">
            {record.author}
          </ParagraphXSmall>
        ) : null}
      </Block>
      <Block display="flex" alignItems="center" gridGap="scale600">
        {record.status ? (
          <Tag closeable={false} kind={TAG_KIND.neutral} size={TAG_SIZE.small}>
            {record.status}
          </Tag>
        ) : null}
        <Button
          kind={BUTTON_KIND.tertiary}
          size={BUTTON_SIZE.compact}
          aria-label={`View record: ${record.title}`}
          onClick={() => onViewRecord(record)}
          data-testid={`${testIdentifier}-view`}
        >
          View record
        </Button>
      </Block>
    </Block>
    <Block as={StyledDivider} margin="0" />
  </Block>
);

const HealthRecordList: FC<HealthRecordListProperties> = ({
  onViewRecord,
  tab,
}) => (
  <RecordListTabContent tab={tab}>
    {(records) => (
      <Block as="ul" margin="0" padding="0" data-testid={`${tab.key}-list`}>
        {records.map((record) => (
          <HealthRecordRow
            key={record.identifier}
            record={record}
            testIdentifier={`${tab.key}-record`}
            onViewRecord={onViewRecord}
          />
        ))}
      </Block>
    )}
  </RecordListTabContent>
);

export default HealthRecordList;
