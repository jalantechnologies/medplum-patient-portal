import { Block } from "baseui/block";
import { StyledDivider } from "baseui/divider";
import { Tag, KIND as TAG_KIND, SIZE as TAG_SIZE } from "baseui/tag";
import {
  LabelMedium,
  ParagraphSmall,
  ParagraphXSmall,
} from "baseui/typography";
import type { FC, PropsWithChildren } from "react";

import { joinDetails, omitRepeatedDetail } from "../../utilities";

interface RecordRowProperties extends PropsWithChildren {
  author: string;
  date: string;
  source: string;
  status: string;
  testIdentifier: string;
  title: string;
}

const RecordRow: FC<RecordRowProperties> = ({
  author,
  children,
  date,
  source,
  status,
  testIdentifier,
  title,
}) => {
  const sourceAndDate = joinDetails(source, date);
  const authorNotSource = omitRepeatedDetail(author, source);

  return (
    <Block as="li" display="block" data-testid={testIdentifier}>
      <Block
        display="flex"
        flexDirection={["column", "column", "row"]}
        alignItems={["flex-start", "flex-start", "center"]}
        justifyContent="space-between"
        gridGap="scale600"
        paddingTop="scale600"
        paddingBottom="scale700"
      >
        <Block display="grid" gridGap="scale100">
          <LabelMedium>{title}</LabelMedium>
          {sourceAndDate ? (
            <ParagraphSmall margin="0" color="contentSecondary">
              {sourceAndDate}
            </ParagraphSmall>
          ) : null}
          {authorNotSource ? (
            <ParagraphXSmall margin="0" color="contentTertiary">
              {authorNotSource}
            </ParagraphXSmall>
          ) : null}
        </Block>
        <Block display="flex" alignItems="center" gridGap="scale600">
          {status ? (
            <Tag
              closeable={false}
              kind={TAG_KIND.neutral}
              size={TAG_SIZE.small}
            >
              {status}
            </Tag>
          ) : null}
          {children}
        </Block>
      </Block>
      <Block as={StyledDivider} margin="0" />
    </Block>
  );
};

export default RecordRow;
