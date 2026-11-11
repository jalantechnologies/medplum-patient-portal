import { Block } from "baseui/block";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import { usePatientName } from "../../hooks";
import AboutYou from "./about-you";
import AtAGlance from "./at-a-glance";
import HealthHistory from "./health-history";
import HealthProfileError from "./health-profile-error";
import useHealthProfile from "./health-profile.hook";

const HealthProfile: FC = () => {
  const { recordOwner } = usePatientName();
  const {
    activeAllergies,
    activeCarePlans,
    activePrescriptions,
    healthProfileErrorMessage,
    retryFailedRows,
  } = useHealthProfile();

  return (
    <Block data-testid="health-profile">
      <ParagraphSmall
        marginTop="0"
        marginBottom="scale800"
        color="contentSecondary"
        data-testid="health-profile-record-owner"
      >
        {recordOwner}
      </ParagraphSmall>
      <HeadingMedium
        as="h1"
        marginTop="0"
        marginBottom="scale300"
        data-testid="health-profile-title"
      >
        Health profile
      </HeadingMedium>
      <ParagraphSmall
        marginTop="0"
        marginBottom="scale900"
        color="contentSecondary"
      >
        A summary for understanding your health. Open each section to see
        individual records.
      </ParagraphSmall>
      {healthProfileErrorMessage ? (
        <HealthProfileError
          message={healthProfileErrorMessage}
          onRetry={retryFailedRows}
        />
      ) : null}
      <Block
        display="grid"
        gridTemplateColumns={["1fr", "1fr", "1fr", "1fr 1.1fr"]}
        gridGap="scale900"
      >
        <AboutYou />
        <AtAGlance
          activeAllergies={activeAllergies}
          activeCarePlans={activeCarePlans}
          activePrescriptions={activePrescriptions}
        />
      </Block>
      <HealthHistory />
    </Block>
  );
};

export default HealthProfile;
