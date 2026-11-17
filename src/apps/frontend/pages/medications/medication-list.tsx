import { Block } from "baseui/block";
import { Card } from "baseui/card";
import { Tag, KIND as TAG_KIND, SIZE as TAG_SIZE } from "baseui/tag";
import {
  HeadingSmall,
  ParagraphMedium,
  ParagraphSmall,
} from "baseui/typography";
import type { FC } from "react";

import { RecordDetail, RecordListTabContent } from "../../components";
import { useRecordDetailColumns } from "../../hooks";
import type { RecordListTab } from "../../types";
import { joinDetails, omitRepeatedDetail } from "../../utilities";
import type { MedicationSummary } from "./medication-summary";

interface MedicationListProperties {
  tab: RecordListTab<MedicationSummary>;
}

interface MedicationCardProperties {
  medication: MedicationSummary;
  testIdentifier: string;
}

const MedicationCard: FC<MedicationCardProperties> = ({
  medication,
  testIdentifier,
}) => {
  const recordDetailColumns = useRecordDetailColumns();
  const prescriberAndSource = joinDetails(
    medication.prescriber,
    omitRepeatedDetail(medication.source, medication.prescriber),
  );

  return (
    <Block as="li" display="block" data-testid={testIdentifier}>
      <Card>
        <Block
          display="flex"
          flexDirection={["column", "column", "row"]}
          alignItems="flex-start"
          justifyContent="space-between"
          gridGap="scale800"
        >
          <Block display="grid" gridGap="scale300">
            <HeadingSmall as="h2" margin="0">
              {medication.title}
            </HeadingSmall>
            {prescriberAndSource ? (
              <ParagraphSmall margin="0" color="contentSecondary">
                {prescriberAndSource}
              </ParagraphSmall>
            ) : null}
          </Block>
          <Block display="flex" flexWrap gridGap="scale300">
            {medication.isDoNotPerform ? (
              <Tag
                closeable={false}
                kind={TAG_KIND.negative}
                size={TAG_SIZE.small}
              >
                Do not take
              </Tag>
            ) : null}
            {medication.status ? (
              <Tag
                closeable={false}
                kind={TAG_KIND.neutral}
                size={TAG_SIZE.small}
              >
                {medication.status}
              </Tag>
            ) : null}
          </Block>
        </Block>
        {medication.instructions.map((instruction, index) => (
          <ParagraphMedium key={index} marginTop="scale800" marginBottom="0">
            {instruction}
          </ParagraphMedium>
        ))}
        {medication.date || medication.received ? (
          <Block
            as="dl"
            display="grid"
            gridTemplateColumns={recordDetailColumns}
            gridGap="scale600"
            marginTop="scale800"
            marginBottom="0"
          >
            <RecordDetail
              label={medication.isDoNotPerform ? "Recorded" : "Prescribed"}
              value={medication.date}
            />
            <RecordDetail label="Received" value={medication.received} />
          </Block>
        ) : null}
      </Card>
    </Block>
  );
};

const MedicationList: FC<MedicationListProperties> = ({ tab }) => (
  <RecordListTabContent tab={tab}>
    {(medications) => (
      <Block
        as="ul"
        display="grid"
        gridGap="scale800"
        margin="0"
        padding="0"
        data-testid={`${tab.key}-list`}
      >
        {medications.map((medication) => (
          <MedicationCard
            key={medication.identifier}
            medication={medication}
            testIdentifier={`${tab.key}-record`}
          />
        ))}
      </Block>
    )}
  </RecordListTabContent>
);

export default MedicationList;
