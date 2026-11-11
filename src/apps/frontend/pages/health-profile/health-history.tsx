import { Block } from "baseui/block";
import { Button, KIND, SIZE } from "baseui/button";
import { HeadingSmall } from "baseui/typography";
import type { FC } from "react";

import { RouterLink } from "../../components";
import { HEALTH_RECORDS_TAB } from "../../constants/routes";
import { buildHealthRecordsTabPath } from "../../utilities";

const healthRecordsTabs = Object.values(HEALTH_RECORDS_TAB);

const HealthHistory: FC = () => (
  <Block as="section" marginTop="scale900">
    <HeadingSmall as="h2" margin="0">
      Health history
    </HeadingSmall>
    <Block
      as="ul"
      display="flex"
      flexWrap
      gridGap={["scale300", "scale300", "scale500"]}
      marginTop="scale600"
      marginBottom="0"
      padding="0"
      data-testid="health-history"
    >
      {healthRecordsTabs.map(({ key, title }) => (
        <Block as="li" display="block" key={key}>
          <Button
            href={buildHealthRecordsTabPath(key)}
            kind={KIND.secondary}
            size={SIZE.compact}
            overrides={{ BaseButton: { props: { $as: RouterLink } } }}
            data-testid={`health-history-${key}`}
          >
            {title}
          </Button>
        </Block>
      ))}
    </Block>
  </Block>
);

export default HealthHistory;
