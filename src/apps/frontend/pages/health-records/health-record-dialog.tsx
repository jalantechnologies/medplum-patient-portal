import { Block } from "baseui/block";
import { KIND as BUTTON_KIND } from "baseui/button";
import {
  Modal,
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
  ROLE,
  SIZE as MODAL_SIZE,
} from "baseui/modal";
import { Tag, KIND as TAG_KIND, SIZE as TAG_SIZE } from "baseui/tag";
import { ParagraphMedium, ParagraphSmall } from "baseui/typography";
import type { FC } from "react";

import type { Nullable } from "../../types";
import type { HealthRecordSummary } from "./health-record-summary";

interface HealthRecordDialogProperties {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  record: Nullable<HealthRecordSummary>;
}

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

const HealthRecordDialog: FC<HealthRecordDialogProperties> = ({
  isOpen,
  onClose,
  patientName,
  record,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    role={ROLE.dialog}
    size={MODAL_SIZE.default}
    overrides={{
      Dialog: {
        props: {
          "aria-label": record?.title,
          "data-testid": "health-record-dialog",
        },
      },
    }}
  >
    {record ? (
      <>
        <ModalHeader>{record.title}</ModalHeader>
        <ModalBody>
          {record.status ? (
            <Tag
              closeable={false}
              kind={TAG_KIND.neutral}
              size={TAG_SIZE.small}
            >
              {record.status}
            </Tag>
          ) : null}
          {record.value ? (
            <ParagraphMedium data-testid="health-record-value">
              {record.value}
            </ParagraphMedium>
          ) : null}
          <Block
            as="dl"
            display="grid"
            gridTemplateColumns="2fr 3fr"
            gridGap="scale600"
            marginTop="scale600"
            marginBottom="0"
            data-testid="health-record-details"
          >
            <RecordDetail label="Patient" value={patientName} />
            <RecordDetail label="Date" value={record.date} />
            <RecordDetail label="Verification" value={record.verification} />
            <RecordDetail label="Author" value={record.author} />
          </Block>
        </ModalBody>
        <ModalFooter>
          <ModalButton
            kind={BUTTON_KIND.tertiary}
            onClick={onClose}
            data-testid="health-record-close"
          >
            Close
          </ModalButton>
        </ModalFooter>
      </>
    ) : null}
  </Modal>
);

export default HealthRecordDialog;
