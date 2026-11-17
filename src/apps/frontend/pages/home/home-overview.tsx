import { Block } from "baseui/block";
import type { FC } from "react";

import type { Fact } from "../../types";
import OverviewFact from "./overview-fact";

interface HomeOverviewProperties {
  activeCarePlans: Fact;
  availableSources: Fact;
  nextVisit: Fact;
}

const HomeOverview: FC<HomeOverviewProperties> = ({
  activeCarePlans,
  availableSources,
  nextVisit,
}) => (
  <Block
    as="dl"
    display="grid"
    gridTemplateColumns={["1fr", "1fr", "repeat(3, 1fr)"]}
    gridGap="scale800"
    margin="0"
    paddingTop="scale800"
    paddingBottom="scale800"
    aria-live="polite"
    data-testid="home-overview"
  >
    <OverviewFact
      {...activeCarePlans}
      label="Current care"
      testIdentifier="active-care-plans"
    />
    <OverviewFact
      {...availableSources}
      label="Available sources"
      testIdentifier="available-sources"
    />
    <OverviewFact
      {...nextVisit}
      label="Next visit"
      testIdentifier="next-visit"
    />
  </Block>
);

export default HomeOverview;
