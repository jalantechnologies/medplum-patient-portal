import { Banner, KIND } from "baseui/banner";
import { Block } from "baseui/block";
import { Tab, Tabs } from "baseui/tabs-motion";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import { useState, type FC } from "react";

import { usePatientName } from "../../hooks";
import type { Nullable } from "../../types";
import HealthRecordDialog from "./health-record-dialog";
import HealthRecordList from "./health-record-list";
import type { HealthRecordSummary } from "./health-record-summary";
import useHealthRecords from "./health-records.hook";

const HealthRecords: FC = () => {
  const { fullName, recordOwner } = usePatientName();
  const { activeTabKey, errorMessage, openTab, retryFailedTabs, tabs } =
    useHealthRecords();
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
      {errorMessage ? (
        <Block role="alert" data-testid="health-records-error">
          <Banner
            kind={KIND.negative}
            action={{ label: "Try again", onClick: retryFailedTabs }}
            overrides={{
              Root: { props: { "aria-label": "Health records error" } },
            }}
          >
            {errorMessage}
          </Banner>
        </Block>
      ) : null}
      <Tabs
        activeKey={activeTabKey}
        onChange={({ activeKey }) => openTab(activeKey)}
        activateOnFocus
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            title={tab.title}
            overrides={{
              Tab: { props: { "data-testid": `${tab.key}-tab` } },
              TabPanel: { props: { "data-testid": `${tab.key}-panel` } },
            }}
          >
            <HealthRecordList tab={tab} onViewRecord={viewRecord} />
          </Tab>
        ))}
      </Tabs>
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
