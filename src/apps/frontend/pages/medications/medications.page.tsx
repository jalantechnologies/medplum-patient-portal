import { Block } from "baseui/block";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import { RecordListTabs } from "../../components";
import { usePatientName } from "../../hooks";
import MedicationList from "./medication-list";
import useMedications from "./medications.hook";

const Medications: FC = () => {
  const { recordOwner } = usePatientName();
  const { activeTabKey, openTab, tabs } = useMedications();

  return (
    <Block data-testid="medications">
      <ParagraphSmall
        marginTop="0"
        marginBottom="scale800"
        color="contentSecondary"
        data-testid="medications-record-owner"
      >
        {recordOwner}
      </ParagraphSmall>
      <HeadingMedium as="h1" marginTop="0" marginBottom="scale900">
        Medications
      </HeadingMedium>
      <RecordListTabs
        activeTabKey={activeTabKey}
        errorLabel="Medications error"
        errorTestIdentifier="medications-error"
        onTabChange={openTab}
        tabs={tabs}
      >
        {(tab) => <MedicationList tab={tab} />}
      </RecordListTabs>
    </Block>
  );
};

export default Medications;
