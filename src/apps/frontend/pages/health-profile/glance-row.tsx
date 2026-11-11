import { Block } from "baseui/block";
import { Button, KIND, SIZE } from "baseui/button";
import { StyledDivider } from "baseui/divider";
import { LabelMedium, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import { FactValue, RouterLink } from "../../components";
import type { Fact, Nullable } from "../../types";

interface GlanceLink {
  label: string;
  path: string;
}

interface GlanceRowProperties {
  fact: Fact;
  link: Nullable<GlanceLink>;
  testIdentifier: string;
  title: string;
}

const GlanceRow: FC<GlanceRowProperties> = ({
  fact: { hasFailed, isLoading, value },
  link,
  testIdentifier,
  title,
}) => (
  <Block as="li" display="block" data-testid={`${testIdentifier}-row`}>
    <Block
      display="flex"
      flexDirection={["column", "column", "row"]}
      alignItems={["flex-start", "flex-start", "center"]}
      justifyContent="space-between"
      gridGap={["scale500", "scale500", "scale800"]}
      paddingTop="scale700"
      paddingBottom="scale700"
    >
      <Block display="grid" gridGap="scale100">
        <LabelMedium>{title}</LabelMedium>
        <FactValue
          hasFailed={hasFailed}
          isLoading={isLoading}
          testIdentifier={testIdentifier}
        >
          <ParagraphSmall margin="0" color="contentSecondary">
            {value}
          </ParagraphSmall>
        </FactValue>
      </Block>
      {link ? (
        <Button
          href={link.path}
          kind={KIND.tertiary}
          size={SIZE.compact}
          aria-label={link.label}
          overrides={{ BaseButton: { props: { $as: RouterLink } } }}
          data-testid={`${testIdentifier}-link`}
        >
          View
        </Button>
      ) : null}
    </Block>
    <Block as={StyledDivider} margin="0" />
  </Block>
);

export default GlanceRow;
