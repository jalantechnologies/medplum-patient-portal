import { ParagraphMedium, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import type { HealthRecordNote } from "./health-record-summary";

interface HealthRecordNoteParagraphProperties {
  note: HealthRecordNote;
}

const describeWriter = (author: string, date: string): string => {
  if (!author) {
    return date;
  }
  return date ? `By ${author}, ${date}` : `By ${author}`;
};

const HealthRecordNoteParagraph: FC<HealthRecordNoteParagraphProperties> = ({
  note: { author, date, text },
}) => {
  const writer = describeWriter(author, date);
  return (
    <>
      <ParagraphMedium
        whiteSpace="pre-line"
        marginBottom={writer ? "0" : undefined}
        data-testid="health-record-note"
      >
        {text}
      </ParagraphMedium>
      {writer ? (
        <ParagraphSmall
          marginTop="scale100"
          color="contentSecondary"
          data-testid="health-record-note-writer"
        >
          {writer}
        </ParagraphSmall>
      ) : null}
    </>
  );
};

export default HealthRecordNoteParagraph;
