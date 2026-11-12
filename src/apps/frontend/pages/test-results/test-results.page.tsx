import { Block } from "baseui/block";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import { RecordListTabs } from "../../components";
import { usePatientName } from "../../hooks";
import TestReportList from "./test-report-list";
import useTestResults from "./test-results.hook";

const TestResults: FC = () => {
  const { recordOwner } = usePatientName();
  const { activeTabKey, openTab, tabs } = useTestResults();

  return (
    <Block data-testid="test-results">
      <ParagraphSmall
        marginTop="0"
        marginBottom="scale800"
        color="contentSecondary"
        data-testid="test-results-record-owner"
      >
        {recordOwner}
      </ParagraphSmall>
      <HeadingMedium as="h1" marginTop="0" marginBottom="scale300">
        Test results
      </HeadingMedium>
      <ParagraphSmall
        marginTop="0"
        marginBottom="scale900"
        color="contentSecondary"
      >
        Lab reports, imaging, and other results.
      </ParagraphSmall>
      <RecordListTabs
        activeTabKey={activeTabKey}
        errorLabel="Test results error"
        errorTestIdentifier="test-results-error"
        onTabChange={openTab}
        tabs={tabs}
      >
        {(tab) => <TestReportList tab={tab} />}
      </RecordListTabs>
    </Block>
  );
};

export default TestResults;
