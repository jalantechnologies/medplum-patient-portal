import { ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

interface RecordDetailProperties {
  label: string;
  value: string;
}

const RecordDetail: FC<RecordDetailProperties> = ({ label, value }) =>
  value ? (
    <>
      <ParagraphSmall as="dt" margin="0" color="contentSecondary">
        {label}
      </ParagraphSmall>
      <ParagraphSmall as="dd" margin="0">
        {value}
      </ParagraphSmall>
    </>
  ) : null;

export default RecordDetail;
