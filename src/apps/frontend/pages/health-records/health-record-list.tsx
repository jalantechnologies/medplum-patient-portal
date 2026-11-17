import { Block } from "baseui/block";
import {
  Button,
  KIND as BUTTON_KIND,
  SIZE as BUTTON_SIZE,
} from "baseui/button";
import type { FC } from "react";

import { RecordListTabContent, RecordRow } from "../../components";
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
  <RecordRow
    author={record.author}
    date={record.date}
    source={record.source}
    status={record.status}
    testIdentifier={testIdentifier}
    title={record.title}
  >
    <Button
      kind={BUTTON_KIND.tertiary}
      size={BUTTON_SIZE.compact}
      aria-label={`View record: ${record.title}`}
      onClick={() => onViewRecord(record)}
      data-testid={`${testIdentifier}-view`}
    >
      View record
    </Button>
  </RecordRow>
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
