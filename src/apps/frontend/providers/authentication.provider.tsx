import { useMedplumContext } from "@medplum/react-hooks";
import {
  useEffect,
  useMemo,
  useState,
  type FC,
  type PropsWithChildren,
} from "react";

import constant from "../constants";
import { RESOURCE_TYPE } from "../constants/fhir";
import { AuthenticationContext } from "../contexts";
import { useAsynchronous } from "../hooks";
import { AuthenticationService } from "../services";
import { AsynchronousOperationError, type Nullable } from "../types";

export const AuthenticationProvider: FC<PropsWithChildren> = ({ children }) => {
  const { medplum, profile, loading } = useMedplumContext();
  const authenticationService = useMemo(
    () => new AuthenticationService(medplum),
    [medplum],
  );
  const [isSessionRestoring, setIsSessionRestoring] = useState(loading);
  const [sessionRestoreError, setSessionRestoreError] =
    useState<Nullable<AsynchronousOperationError>>(null);

  useEffect(() => {
    const finishSessionRestore = async () => {
      try {
        await authenticationService.restoreSession();
        setIsSessionRestoring(false);
      } catch (error) {
        setSessionRestoreError(
          AsynchronousOperationError.fromUnknown(
            error,
            constant.DEFAULT_ERROR_MESSAGE,
          ),
        );
      }
    };
    void finishSessionRestore();
  }, [authenticationService]);

  const { asynchronousCallback: signIn, isLoading: isSignInLoading } =
    useAsynchronous(authenticationService.signIn);

  const { asynchronousCallback: signOut, isLoading: isSignOutLoading } =
    useAsynchronous(authenticationService.signOut);

  const { asynchronousCallback: signUp, isLoading: isSignUpLoading } =
    useAsynchronous(authenticationService.signUp);

  const isUserAuthenticated = profile?.resourceType === RESOURCE_TYPE.PATIENT;

  const value = useMemo(
    () => ({
      isSessionRestoring,
      isSignInLoading,
      isSignOutLoading,
      isSignUpLoading,
      isUserAuthenticated,
      signIn,
      signOut,
      signUp,
    }),
    [
      isSessionRestoring,
      isSignInLoading,
      isSignOutLoading,
      isSignUpLoading,
      isUserAuthenticated,
      signIn,
      signOut,
      signUp,
    ],
  );

  if (sessionRestoreError) {
    throw sessionRestoreError;
  }
  return (
    <AuthenticationContext.Provider value={value}>
      {children}
    </AuthenticationContext.Provider>
  );
};
