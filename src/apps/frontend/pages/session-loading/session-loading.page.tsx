import { Block } from "baseui/block";
import { SIZE, Spinner } from "baseui/spinner";
import { ParagraphSmall } from "baseui/typography";

export default function SessionLoading() {
  return (
    <Block
      as="main"
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
    >
      <Block
        as="output"
        display="grid"
        gridAutoFlow="column"
        gridColumnGap="scale300"
        alignItems="center"
        data-testid="session-loading"
      >
        <Spinner $size={SIZE.small} />
        <ParagraphSmall margin="0" color="contentSecondary">
          Loading…
        </ParagraphSmall>
      </Block>
    </Block>
  );
}
