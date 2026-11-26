import { Block } from "baseui/block";
import { Button, SIZE } from "baseui/button";
import { HeadingMedium, ParagraphSmall } from "baseui/typography";
import { useEffect, useRef, type FC, type PropsWithChildren } from "react";

interface ErrorMessageProperties {
  isRetryFocused?: boolean;
  onRetry: () => void;
}

const ErrorMessage: FC<PropsWithChildren<ErrorMessageProperties>> = ({
  children,
  isRetryFocused = false,
  onRetry,
}) => {
  const retryReference = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isRetryFocused) {
      retryReference.current?.focus();
    }
  }, [isRetryFocused]);

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
          ref={retryReference}
          size={SIZE.compact}
          onClick={onRetry}
          data-testid="page-error-retry"
        >
          Try again
        </Button>
        {children}
      </Block>
    </Block>
  );
};

export default ErrorMessage;
