import type { Appointment } from "@medplum/fhirtypes";
import { Banner, KIND } from "baseui/banner";
import { Block } from "baseui/block";
import { StyledDivider } from "baseui/divider";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import constant from "../../constants";
import { usePatientName } from "../../hooks";
import type { Nullable } from "../../types";
import useHomeOverview from "./home-overview.hook";
import OverviewFact from "./overview-fact";

const describeActiveCarePlans = (activeCarePlanCount: Nullable<number>) => {
  if (!activeCarePlanCount) {
    return "No ongoing plans";
  }
  return activeCarePlanCount === 1
    ? "1 ongoing plan"
    : `${activeCarePlanCount} ongoing plans`;
};

const describeNextVisit = (appointment: Nullable<Appointment>) => {
  if (!appointment?.start) {
    return "None booked";
  }
  const start = new Date(appointment.start);
  const day = start.toLocaleDateString(constant.LOCALE, {
    month: "short",
    day: "numeric",
  });
  const time = start.toLocaleTimeString(constant.LOCALE, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
};

const Home: FC = () => {
  const { fullName, givenName } = usePatientName();
  const {
    activeCarePlanCount,
    hasActiveCarePlanCountFailed,
    hasNextAppointmentFailed,
    isActiveCarePlanCountLoading,
    isNextAppointmentLoading,
    loadOverview,
    nextAppointment,
    overviewErrorMessage,
  } = useHomeOverview();

  const greeting = givenName ? `Hello, ${givenName}` : "Hello";
  const recordOwner = fullName ? `Your record · ${fullName}` : "Your record";

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
          label="Current care"
          value={describeActiveCarePlans(activeCarePlanCount)}
          isLoading={isActiveCarePlanCountLoading}
          hasFailed={hasActiveCarePlanCountFailed}
          testIdentifier="active-care-plans"
        />
        <OverviewFact
          label="Next visit"
          value={describeNextVisit(nextAppointment)}
          isLoading={isNextAppointmentLoading}
          hasFailed={hasNextAppointmentFailed}
          testIdentifier="next-visit"
        />
      </Block>
      <Block as={StyledDivider} margin="0" />
    </Block>
  );
};

export default Home;
