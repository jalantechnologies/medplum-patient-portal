import { Block } from "baseui/block";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";

export default function NotFound() {
  return (
    <Block display="grid" gridGap="scale300" data-testid="not-found">
      <HeadingMedium as="h1" margin="0">
        Page not found
      </HeadingMedium>
      <ParagraphSmall margin="0" color="contentSecondary">
        The page you are looking for does not exist.
      </ParagraphSmall>
    </Block>
  );
}
