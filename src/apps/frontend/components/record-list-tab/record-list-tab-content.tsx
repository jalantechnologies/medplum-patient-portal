import { Block } from "baseui/block";
import {
  Button,
  KIND as BUTTON_KIND,
  SIZE as BUTTON_SIZE,
} from "baseui/button";
import { LabelMedium, ParagraphSmall } from "baseui/typography";
import type { ReactNode } from "react";

import type { RecordListTab, RecordSummary } from "../../types";

interface RecordListTabContentProperties<Summary extends RecordSummary> {
  children: (records: Summary[]) => ReactNode;
  tab: RecordListTab<Summary>;
}

const RecordListTabState = <Summary extends RecordSummary>({
  children,
  tab,
}: RecordListTabContentProperties<Summary>) => {
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
  if (tab.records.length === 0) {
    return (
      <Block display="grid" gridGap="scale100" data-testid={`${tab.key}-empty`}>
        <LabelMedium>{tab.emptyTitle}</LabelMedium>
        <ParagraphSmall margin="0" color="contentSecondary">
          {tab.emptyDescription}
        </ParagraphSmall>
      </Block>
    );
  }
  return (
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
};

const RecordListTabContent = <Summary extends RecordSummary>({
  children,
  tab,
}: RecordListTabContentProperties<Summary>) => (
  <Block aria-live="polite" data-testid={`${tab.key}-content`}>
    <RecordListTabState tab={tab}>{children}</RecordListTabState>
  </Block>
);

export default RecordListTabContent;
