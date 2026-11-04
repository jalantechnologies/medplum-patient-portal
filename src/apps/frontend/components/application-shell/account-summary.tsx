import { Avatar } from "baseui/avatar";
import { Block } from "baseui/block";
import { Button, KIND, SIZE } from "baseui/button";
import { StyledDivider } from "baseui/divider";
import { LabelSmall, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

interface AccountSummaryProperties {
  patientName: string;
  isSignOutLoading: boolean;
  onSignOut: () => void;
}

const AccountSummary: FC<AccountSummaryProperties> = ({
  isSignOutLoading,
  onSignOut,
  patientName,
}) => (
  <Block marginTop="scale900" marginLeft="scale600" marginRight="scale600">
    <Block as={StyledDivider} margin="0" />
    <Block
      display="grid"
      gridAutoFlow="column"
      justifyContent="start"
      alignItems="center"
      gridColumnGap="scale500"
      paddingTop="scale800"
    >
      <Avatar name={patientName} />
      <Block>
        <LabelSmall data-testid="account-name">{patientName}</LabelSmall>
        <ParagraphSmall margin="0" color="contentSecondary">
          Account owner
        </ParagraphSmall>
      </Block>
    </Block>
    <Block paddingTop="scale600">
      <Button
        kind={KIND.tertiary}
        size={SIZE.compact}
        isLoading={isSignOutLoading}
        onClick={onSignOut}
        data-testid="sign-out"
      >
        Sign out
      </Button>
    </Block>
  </Block>
);

export default AccountSummary;
