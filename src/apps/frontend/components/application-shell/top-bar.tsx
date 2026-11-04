import { Block } from "baseui/block";
import { Button, KIND, SIZE } from "baseui/button";
import { ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

interface TopBarProperties {
  brand: string;
  isNavigationOpen: boolean;
  onOpenNavigation: () => void;
}

const TopBar: FC<TopBarProperties> = ({
  brand,
  isNavigationOpen,
  onOpenNavigation,
}) => (
  <Block
    as="header"
    display="grid"
    gridAutoFlow="column"
    justifyContent="start"
    alignItems="center"
    gridColumnGap="scale500"
    minHeight="scale1200"
    paddingTop="scale600"
    paddingBottom="scale600"
    paddingLeft="scale800"
    paddingRight="scale800"
  >
    <Block display={["block", "block", "block", "none"]}>
      <Button
        kind={KIND.tertiary}
        size={SIZE.compact}
        aria-label="Open navigation"
        aria-expanded={isNavigationOpen}
        onClick={onOpenNavigation}
        data-testid="open-navigation"
      >
        ☰
      </Button>
    </Block>
    <ParagraphSmall margin="0" color="contentSecondary">
      {brand}
    </ParagraphSmall>
  </Block>
);

export default TopBar;
