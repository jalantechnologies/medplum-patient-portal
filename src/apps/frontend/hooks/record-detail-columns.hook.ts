import { useStyletron } from "baseui";

const useRecordDetailColumns = (): string[] => {
  const [, theme] = useStyletron();
  const smallLabelColumn = `${theme.sizing.scale3200} 1fr`;
  const largeLabelColumn = `${theme.sizing.scale4800} 1fr`;
  return [smallLabelColumn, smallLabelColumn, largeLabelColumn];
};

export default useRecordDetailColumns;
