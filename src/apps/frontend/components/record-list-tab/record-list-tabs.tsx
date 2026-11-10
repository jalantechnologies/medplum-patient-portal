import { Banner, KIND } from "baseui/banner";
import { Block } from "baseui/block";
import { Tab, Tabs } from "baseui/tabs-motion";
import type { Key, ReactNode } from "react";

import type { RecordListTab, RecordSummary } from "../../types";

interface RecordListTabsProperties<Summary extends RecordSummary> {
  activeTabKey: Key;
  children: (tab: RecordListTab<Summary>) => ReactNode;
  errorLabel: string;
  errorTestIdentifier: string;
  onTabChange: (tabKey: Key) => void;
  tabs: RecordListTab<Summary>[];
}

const RecordListTabs = <Summary extends RecordSummary>({
  activeTabKey,
  children,
  errorLabel,
  errorTestIdentifier,
  onTabChange,
  tabs,
}: RecordListTabsProperties<Summary>) => {
  const failedTabs = tabs.filter(({ error }) => error !== null);
  const retryFailedTabs = async () => {
    await Promise.all(failedTabs.map(({ retry }) => retry()));
  };

  return (
    <>
      {failedTabs.length > 0 ? (
        <Block role="alert" data-testid={errorTestIdentifier}>
          <Banner
            kind={KIND.negative}
            action={{ label: "Try again", onClick: retryFailedTabs }}
            overrides={{ Root: { props: { "aria-label": errorLabel } } }}
          >
            {failedTabs[0].error?.message}
          </Banner>
        </Block>
      ) : null}
      <Tabs
        activeKey={activeTabKey}
        onChange={({ activeKey }) => onTabChange(activeKey)}
        activateOnFocus
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            title={tab.title}
            overrides={{
              Tab: { props: { "data-testid": `${tab.key}-tab` } },
              TabPanel: { props: { "data-testid": `${tab.key}-panel` } },
            }}
          >
            {children(tab)}
          </Tab>
        ))}
      </Tabs>
    </>
  );
};

export default RecordListTabs;
