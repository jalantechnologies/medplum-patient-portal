import { Block } from "baseui/block";
import { HeadingSmall } from "baseui/typography";
import type { FC } from "react";

import routes, { HEALTH_RECORDS_TAB } from "../../constants/routes";
import type { Fact } from "../../types";
import { buildHealthRecordsTabPath } from "../../utilities";
import GlanceRow from "./glance-row";

interface AtAGlanceProperties {
  activeAllergies: Fact;
  activeCarePlans: Fact;
  activePrescriptions: Fact;
}

const AtAGlance: FC<AtAGlanceProperties> = ({
  activeAllergies,
  activeCarePlans,
  activePrescriptions,
}) => (
  <Block as="section">
    <HeadingSmall as="h2" margin="0">
      At a glance
    </HeadingSmall>
    <Block
      as="ul"
      marginTop="scale600"
      marginBottom="0"
      padding="0"
      aria-live="polite"
      data-testid="at-a-glance"
    >
      <GlanceRow
        title="Current treatment"
        fact={activeCarePlans}
        link={null}
        testIdentifier="health-profile-active-care-plans"
      />
      <GlanceRow
        title="Medications"
        fact={activePrescriptions}
        link={{ label: "View medications", path: routes.MEDICATIONS }}
        testIdentifier="health-profile-active-prescriptions"
      />
      <GlanceRow
        title="Allergies"
        fact={activeAllergies}
        link={{
          label: "View allergies",
          path: buildHealthRecordsTabPath(HEALTH_RECORDS_TAB.ALLERGIES.key),
        }}
        testIdentifier="health-profile-active-allergies"
      />
    </Block>
  </Block>
);

export default AtAGlance;
