import { Block } from "baseui/block";
import { HeadingSmall } from "baseui/typography";
import type { FC } from "react";

import { RecordDetail } from "../../components";
import { usePatientName, useRecordDetailColumns } from "../../hooks";

const AboutYou: FC = () => {
  const { fullName } = usePatientName();
  const recordDetailColumns = useRecordDetailColumns();

  return (
    <Block as="section">
      <HeadingSmall as="h2" margin="0">
        About you
      </HeadingSmall>
      <Block
        as="dl"
        display="grid"
        gridTemplateColumns={recordDetailColumns}
        gridGap="scale600"
        marginTop="scale800"
        marginBottom="0"
        data-testid="about-you"
      >
        <RecordDetail label="Patient" value={fullName} />
        <RecordDetail label="Record access" value="Your own record" />
      </Block>
    </Block>
  );
};

export default AboutYou;
