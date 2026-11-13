import { Block } from "baseui/block";
import {
  Button,
  KIND as BUTTON_KIND,
  SIZE as BUTTON_SIZE,
} from "baseui/button";
import { LabelMedium, ParagraphSmall } from "baseui/typography";
import type { ReactNode } from "react";

import type { RecordListTab, RecordSummary } from "../../types";
import { describeCount } from "../../utilities";

interface RecordListTabProperties<Summary extends RecordSummary> {
  tab: RecordListTab<Summary>;
}

interface RecordListTabContentProperties<
  Summary extends RecordSummary,
> extends RecordListTabProperties<Summary> {
  children: (records: Summary[]) => ReactNode;
}

const RECORD_COUNT_WORDS = {
  none: "No records shown",
  plural: "records shown",
  singular: "record shown",
};

const RecordListTabNotice = <Summary extends RecordSummary>({
  tab,
}: RecordListTabProperties<Summary>) => {
  if (tab.isLoading) {
    return (
      <ParagraphSmall
        margin="0"
        color="contentSecondary"
        data-testid={`${tab.key}-loading`}
      >
        Loading…
      </ParagraphSmall>
    );
  }
  if (tab.hasFailed) {
    return (
      <ParagraphSmall
        margin="0"
        color="contentSecondary"
        data-testid={`${tab.key}-unavailable`}
      >
        Could not load
      </ParagraphSmall>
    );
  }
  return (
    <Block display="grid" gridGap="scale100" data-testid={`${tab.key}-empty`}>
      <LabelMedium>{tab.emptyTitle}</LabelMedium>
      <ParagraphSmall margin="0" color="contentSecondary">
        {tab.emptyDescription}
      </ParagraphSmall>
    </Block>
  );
};

const RecordListTabRecords = <Summary extends RecordSummary>({
  children,
  tab,
}: RecordListTabContentProperties<Summary>) => (
  <>
    {children(tab.records)}
    {tab.hasMoreRecords ? (
      <Block paddingTop="scale600">
        <Button
          kind={BUTTON_KIND.secondary}
          size={BUTTON_SIZE.compact}
          isLoading={tab.isRequesting}
          onClick={tab.listMoreRecords}
          data-testid={`${tab.key}-more`}
        >
          Show more
        </Button>
      </Block>
    ) : null}
  </>
);

const RecordListTabContent = <Summary extends RecordSummary>({
  children,
  tab,
}: RecordListTabContentProperties<Summary>) => {
  const hasRecords = tab.records.length > 0;

  return (
    <Block data-testid={`${tab.key}-content`}>
      <Block role="status" data-testid={`${tab.key}-status`}>
        {hasRecords ? (
          <Block className="visually-hidden" data-testid={`${tab.key}-count`}>
            {describeCount(tab.records.length, RECORD_COUNT_WORDS)}
          </Block>
        ) : (
          <RecordListTabNotice tab={tab} />
        )}
      </Block>
      {hasRecords ? (
        <RecordListTabRecords tab={tab}>{children}</RecordListTabRecords>
      ) : null}
    </Block>
  );
};

export default RecordListTabContent;
