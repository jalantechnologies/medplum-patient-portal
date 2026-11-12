import { Block } from "baseui/block";
import { Card } from "baseui/card";
import { Table, SIZE as TABLE_SIZE } from "baseui/table-semantic";
import { Tag, KIND as TAG_KIND, SIZE as TAG_SIZE } from "baseui/tag";
import {
  HeadingSmall,
  LabelMedium,
  ParagraphMedium,
  ParagraphSmall,
} from "baseui/typography";
import type { FC } from "react";

import { RecordListTabContent } from "../../components";
import type { RecordListTab } from "../../types";
import type {
  TestReportSummary,
  TestResultSummary,
} from "./test-report-summary";

const BYLINE_SEPARATOR = " · ";

const RESULT_COLUMNS = ["Test", "Result", "Reference range", "Flag"];

const INDENT_BY_DEPTH = [0, "scale600", "scale900", "scale1200"] as const;

const REFERENCE_RANGE_NOTICE =
  "A reference range helps put this value in context. A flag alone does not diagnose a condition, and an in-range result does not rule out all illness.";

const DOCUMENT_NOTICE =
  "The full report is a document, which is not shown here.";

interface TestReportListProperties {
  tab: RecordListTab<TestReportSummary>;
}

interface TestReportCardProperties {
  report: TestReportSummary;
  testIdentifier: string;
}

interface TestResultTableProperties {
  results: TestResultSummary[];
  testIdentifier: string;
  title: string;
}

const describeByline = ({ date, performer }: TestReportSummary): string =>
  [date, performer].filter(Boolean).join(BYLINE_SEPARATOR);

const selectIndent = (depth: number) =>
  INDENT_BY_DEPTH[Math.min(depth, INDENT_BY_DEPTH.length - 1)];

const renderResultRow = (result: TestResultSummary, testIdentifier: string) => [
  <Block key="test" paddingLeft={selectIndent(result.depth)}>
    {result.test}
  </Block>,
  <Block key="value">
    <LabelMedium>{result.value}</LabelMedium>
    {result.status ? (
      <ParagraphSmall
        margin="0"
        color="contentSecondary"
        data-testid={`${testIdentifier}-result-status`}
      >
        {result.status}
      </ParagraphSmall>
    ) : null}
  </Block>,
  result.referenceRanges.map((referenceRange, index) => (
    <Block key={index}>{referenceRange}</Block>
  )),
  result.flag,
];

const TestResultTable: FC<TestResultTableProperties> = ({
  results,
  testIdentifier,
  title,
}) => (
  <Table
    columns={RESULT_COLUMNS}
    size={TABLE_SIZE.compact}
    data={results.map((result) => renderResultRow(result, testIdentifier))}
    overrides={{
      Root: {
        props: {
          "aria-label": `${title} results`,
          "data-testid": `${testIdentifier}-results`,
          role: "region",
          tabIndex: 0,
        },
      },
      TableHeadCell: {
        props: { "data-testid": `${testIdentifier}-result-heading` },
      },
      TableBodyRow: { props: { "data-testid": `${testIdentifier}-result` } },
      TableBodyCell: {
        props: { "data-testid": `${testIdentifier}-result-cell` },
      },
    }}
  />
);

const TestReportHeader: FC<TestReportCardProperties> = ({
  report,
  testIdentifier,
}) => {
  const byline = describeByline(report);

  return (
    <Block
      display="flex"
      flexDirection={["column", "column", "row"]}
      alignItems="flex-start"
      justifyContent="space-between"
      gridGap="scale800"
    >
      <Block display="grid" gridGap="scale300">
        <HeadingSmall
          as="h2"
          margin="0"
          data-testid={`${testIdentifier}-title`}
        >
          {report.title}
        </HeadingSmall>
        {byline ? (
          <ParagraphSmall
            margin="0"
            color="contentSecondary"
            data-testid={`${testIdentifier}-byline`}
          >
            {byline}
          </ParagraphSmall>
        ) : null}
      </Block>
      <Tag
        closeable={false}
        kind={TAG_KIND.neutral}
        size={TAG_SIZE.small}
        overrides={{
          Root: { props: { "data-testid": `${testIdentifier}-status` } },
        }}
      >
        {report.status}
      </Tag>
    </Block>
  );
};

const TestReportNotes: FC<TestReportCardProperties> = ({
  report,
  testIdentifier,
}) => (
  <>
    {report.conclusion ? (
      <ParagraphMedium
        marginTop="scale800"
        marginBottom="0"
        data-testid={`${testIdentifier}-conclusion`}
      >
        {report.conclusion}
      </ParagraphMedium>
    ) : null}
    {report.hasDocument ? (
      <ParagraphMedium
        marginTop="scale800"
        marginBottom="0"
        data-testid={`${testIdentifier}-document`}
      >
        {DOCUMENT_NOTICE}
      </ParagraphMedium>
    ) : null}
    {report.results.length > 0 ? (
      <ParagraphMedium
        marginTop="scale800"
        marginBottom="0"
        data-testid={`${testIdentifier}-notice`}
      >
        {REFERENCE_RANGE_NOTICE}
      </ParagraphMedium>
    ) : null}
  </>
);

const TestReportCard: FC<TestReportCardProperties> = ({
  report,
  testIdentifier,
}) => (
  <Block as="li" display="block" minWidth="0" data-testid={testIdentifier}>
    <Card>
      <TestReportHeader report={report} testIdentifier={testIdentifier} />
      {report.results.length > 0 ? (
        <Block marginTop="scale800">
          <TestResultTable
            results={report.results}
            testIdentifier={testIdentifier}
            title={report.title}
          />
        </Block>
      ) : null}
      <TestReportNotes report={report} testIdentifier={testIdentifier} />
    </Card>
  </Block>
);

const TestReportList: FC<TestReportListProperties> = ({ tab }) => (
  <RecordListTabContent tab={tab}>
    {(reports) => (
      <Block
        as="ul"
        display="grid"
        gridGap="scale800"
        margin="0"
        padding="0"
        data-testid={`${tab.key}-list`}
      >
        {reports.map((report) => (
          <TestReportCard
            key={report.identifier}
            report={report}
            testIdentifier={`${tab.key}-record`}
          />
        ))}
      </Block>
    )}
  </RecordListTabContent>
);

export default TestReportList;
