import { Block } from "baseui/block";
import { Button, SIZE } from "baseui/button";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import type { PropsWithChildren } from "react";
import { useLocation, useNavigate } from "react-router";

export default function PageError({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Block role="alert" data-testid="page-error">
      <Block display="grid" gridGap="scale300">
        <HeadingMedium as="h1" margin="0">
          Something went wrong
        </HeadingMedium>
        <ParagraphSmall margin="0" color="contentSecondary">
          We're sorry, but an unexpected error has occurred.
        </ParagraphSmall>
      </Block>
      <Block display="flex" flexWrap gridGap="scale300" paddingTop="scale600">
        <Button
          size={SIZE.compact}
          onClick={() =>
            navigate(location, { replace: true, state: location.state })
          }
          data-testid="page-error-retry"
        >
          Try again
        </Button>
        {children}
      </Block>
    </Block>
  );
}
