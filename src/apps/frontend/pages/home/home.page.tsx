import { Banner, KIND } from "baseui/banner";
import { Block } from "baseui/block";
import { StyledDivider } from "baseui/divider";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import { usePatientName } from "../../hooks";
import ConnectedRecords from "./connected-records";
import CurrentCare from "./current-care";
import HomeOverview from "./home-overview";
import useHomeOverview from "./home-overview.hook";

const Home: FC = () => {
  const { givenName, recordOwner } = usePatientName();
  const {
    connectedRecords,
    currentCare,
    loadOverview,
    overview,
    overviewErrorMessage,
  } = useHomeOverview();

  const greeting = givenName ? `Hello, ${givenName}` : "Hello";

  return (
    <Block data-testid="home">
      <ParagraphSmall
        marginTop="0"
        marginBottom="scale800"
        color="contentSecondary"
        data-testid="home-record-owner"
      >
        {recordOwner}
      </ParagraphSmall>
      <HeadingMedium
        as="h1"
        marginTop="0"
        marginBottom="scale900"
        data-testid="home-greeting"
      >
        {greeting}
      </HeadingMedium>
      {overviewErrorMessage ? (
        <Block role="alert" data-testid="home-overview-error">
          <Banner
            kind={KIND.negative}
            action={{ label: "Try again", onClick: loadOverview }}
            overrides={{
              Root: { props: { "aria-label": "Home overview error" } },
            }}
          >
            {overviewErrorMessage}
          </Banner>
        </Block>
      ) : null}
      <Block as={StyledDivider} margin="0" />
      <HomeOverview {...overview} />
      <Block as={StyledDivider} margin="0" />
      <Block
        display="grid"
        gridTemplateColumns={["1fr", "1fr", "5fr 2fr"]}
        gridGap="scale800"
        paddingTop="scale1000"
      >
        <CurrentCare {...currentCare} />
        <ConnectedRecords {...connectedRecords} />
      </Block>
    </Block>
  );
};

export default Home;
