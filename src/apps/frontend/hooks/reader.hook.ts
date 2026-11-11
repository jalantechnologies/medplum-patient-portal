import { useEffect } from "react";

const useReader = (addReader: () => () => void) => {
  useEffect(() => addReader(), [addReader]);
};

export default useReader;
