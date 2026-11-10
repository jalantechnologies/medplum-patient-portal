import { Block } from "baseui/block";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import { useState, type FC } from "react";

import { RecordListTabs } from "../../components";
import { usePatientName } from "../../hooks";
import type { Nullable } from "../../types";
import HealthRecordDialog from "./health-record-dialog";
import HealthRecordList from "./health-record-list";
import type { HealthRecordSummary } from "./health-record-summary";
import useHealthRecords from "./health-records.hook";

const HealthRecords: FC = () => {
  const { fullName, recordOwner } = usePatientName();
  const { activeTabKey, openTab, tabs } = useHealthRecords();
  const [viewedRecord, setViewedRecord] =
    useState<Nullable<HealthRecordSummary>>(null);
  const [isRecordOpen, setIsRecordOpen] = useState(false);

  const viewRecord = (record: HealthRecordSummary) => {
    setViewedRecord(record);
    setIsRecordOpen(true);
  };

  return (
    <Block data-testid="health-records">
      <ParagraphSmall
        marginTop="0"
        marginBottom="scale800"
        color="contentSecondary"
        data-testid="health-records-record-owner"
      >
        {recordOwner}
      </ParagraphSmall>
      <HeadingMedium as="h1" marginTop="0" marginBottom="scale300">
        Health records
      </HeadingMedium>
      <ParagraphSmall
        marginTop="0"
        marginBottom="scale900"
        color="contentSecondary"
      >
        Browse your available history by type.
      </ParagraphSmall>
      <RecordListTabs
        activeTabKey={activeTabKey}
        errorLabel="Health records error"
        errorTestIdentifier="health-records-error"
        onTabChange={openTab}
        tabs={tabs}
      >
        {(tab) => <HealthRecordList tab={tab} onViewRecord={viewRecord} />}
      </RecordListTabs>
      <HealthRecordDialog
        isOpen={isRecordOpen}
        record={viewedRecord}
        patientName={fullName}
        onClose={() => setIsRecordOpen(false)}
      />
    </Block>
  );
};

export default HealthRecords;
