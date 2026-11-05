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

import type { HealthRecordSummary } from "./health-record-summary";
import type { HealthRecordTab } from "./health-record-tab.hook";

interface HealthRecordListProperties {
  onViewRecord: (record: HealthRecordSummary) => void;
  tab: HealthRecordTab;
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
        >
          View record
        </Button>
      </Block>
    </Block>
    <Block as={StyledDivider} margin="0" />
  </Block>
);

const HealthRecordRows: FC<HealthRecordListProperties> = ({
  onViewRecord,
  tab,
}) => (
  <>
    <Block as="ul" margin="0" padding="0" data-testid={`${tab.key}-list`}>
      {tab.records.map((record) => (
        <HealthRecordRow
          key={record.identifier}
          record={record}
          testIdentifier={`${tab.key}-record`}
          onViewRecord={onViewRecord}
        />
      ))}
    </Block>
    {tab.hasMoreRecords ? (
      <Block paddingTop="scale600">
        <Button
          kind={BUTTON_KIND.secondary}
          size={BUTTON_SIZE.compact}
          isLoading={tab.isRequesting}
          onClick={tab.listMoreRecords}
          data-testid={`${tab.key}-more`}
        >
          Show more
        </Button>
      </Block>
    ) : null}
  </>
);

const HealthRecordTabContent: FC<HealthRecordListProperties> = ({
  onViewRecord,
  tab,
}) => {
  if (tab.isLoading) {
    return (
      <ParagraphSmall
        margin="0"
        color="contentSecondary"
        data-testid={`${tab.key}-loading`}
      >
        Loading…
      </ParagraphSmall>
    );
  }
  if (tab.hasFailed) {
    return (
      <ParagraphSmall
        margin="0"
        color="contentSecondary"
        data-testid={`${tab.key}-unavailable`}
      >
        Could not load
      </ParagraphSmall>
    );
  }
  if (tab.records.length === 0) {
    return (
      <Block display="grid" gridGap="scale100" data-testid={`${tab.key}-empty`}>
        <LabelMedium>{tab.emptyTitle}</LabelMedium>
        <ParagraphSmall margin="0" color="contentSecondary">
          {tab.emptyDescription}
        </ParagraphSmall>
      </Block>
    );
  }
  return <HealthRecordRows tab={tab} onViewRecord={onViewRecord} />;
};

const HealthRecordList: FC<HealthRecordListProperties> = ({
  onViewRecord,
  tab,
}) => (
  <Block aria-live="polite" data-testid={`${tab.key}-content`}>
    <HealthRecordTabContent tab={tab} onViewRecord={onViewRecord} />
  </Block>
);

export default HealthRecordList;
