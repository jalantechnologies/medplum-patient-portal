import { zodResolver } from "@hookform/resolvers/zod";
import {
  OperationOutcomeError,
  operationOutcomeIssueToString,
} from "@medplum/core";
import type { OperationOutcomeIssue } from "@medplum/fhirtypes";
import { createRef, useEffect, useState } from "react";
import { useForm, type UseFormSetError } from "react-hook-form";
import { z } from "zod";

import constant from "../../constants";
import { useAuthenticationContext } from "../../contexts";
import {
  IncompleteSignUpError,
  type AsynchronousOperationError,
  type Nullable,
  type SignUpParameters,
} from "../../types";

const signUpSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { error: constant.FIRST_NAME_VALIDATION_ERROR }),
  lastName: z
    .string()
    .trim()
    .min(1, { error: constant.LAST_NAME_VALIDATION_ERROR }),
  email: z.email({ error: constant.EMAIL_VALIDATION_ERROR }),
  password: z.string().min(1, { error: constant.PASSWORD_VALIDATION_ERROR }),
}) satisfies z.ZodType<Omit<SignUpParameters, "loginIdentifier">>;

type SignUpField = keyof z.infer<typeof signUpSchema>;

const SIGN_UP_FIELDS = Object.keys(signUpSchema.shape) as SignUpField[];

const createInputReferences = () => ({
  firstName: createRef<HTMLInputElement>(),
  lastName: createRef<HTMLInputElement>(),
  email: createRef<HTMLInputElement>(),
  password: createRef<HTMLInputElement>(),
});

const isSignUpField = (expression: string | undefined): boolean =>
  SIGN_UP_FIELDS.some((field) => field === expression);

const findIssues = (
  error: AsynchronousOperationError,
): OperationOutcomeIssue[] =>
  error.cause instanceof OperationOutcomeError
    ? (error.cause.outcome.issue ?? [])
    : [];

const describeFieldIssues = (
  issues: OperationOutcomeIssue[],
  field: SignUpField,
): string => {
  const reasons = issues
    .filter((issue) => issue.expression?.[0] === field)
    .map(
      (issue) =>
        issue.details?.text ??
        issue.diagnostics ??
        constant.DEFAULT_ERROR_MESSAGE,
    );
  return [...new Set(reasons)].join(" ");
};

const describeOtherIssues = (
  error: AsynchronousOperationError,
  issues: OperationOutcomeIssue[],
): string | undefined => {
  const otherIssues = issues.filter(
    (issue) => !isSignUpField(issue.expression?.[0]),
  );
  if (otherIssues.length > 0) {
    return otherIssues.map(operationOutcomeIssueToString).join("; ");
  }
  return issues.length === 0 ? error.message : undefined;
};

const useFieldFocus = (isSignUpLoading: boolean) => {
  const [inputReferences] = useState(createInputReferences);
  const [fieldToFocus, setFieldToFocus] = useState<Nullable<SignUpField>>(null);

  useEffect(() => {
    if (fieldToFocus && !isSignUpLoading) {
      inputReferences[fieldToFocus].current?.focus();
    }
  }, [fieldToFocus, inputReferences, isSignUpLoading]);

  return { inputReferences, setFieldToFocus };
};

const useSignUpErrors = (
  isSignUpLoading: boolean,
  setError: UseFormSetError<z.infer<typeof signUpSchema>>,
) => {
  const { inputReferences, setFieldToFocus } = useFieldFocus(isSignUpLoading);

  const clearFieldToFocus = () => setFieldToFocus(null);

  const showSignUpError = (error: AsynchronousOperationError) => {
    const issues = findIssues(error);
    const fieldReasons = SIGN_UP_FIELDS.map((field) => ({
      field,
      reason: describeFieldIssues(issues, field),
    })).filter(({ reason }) => reason !== "");
    fieldReasons.forEach(({ field, reason }) =>
      setError(field, { message: reason }),
    );
    setFieldToFocus(fieldReasons[0]?.field ?? null);
    const otherReasons = describeOtherIssues(error, issues);
    if (otherReasons) {
      setError("root.signUp", { message: otherReasons });
    }
  };

  return { clearFieldToFocus, inputReferences, showSignUpError };
};

const useSignUpForm = () => {
  const { isSignUpLoading, signUp } = useAuthenticationContext();
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });
  const { clearFieldToFocus, inputReferences, showSignUpError } =
    useSignUpErrors(isSignUpLoading, form.setError);
  const [loginIdentifier, setLoginIdentifier] = useState<string>();

  const submitSignUp = form.handleSubmit(async (values) => {
    clearFieldToFocus();
    try {
      await signUp({ ...values, loginIdentifier });
    } catch (error) {
      if (error instanceof IncompleteSignUpError) {
        setLoginIdentifier(error.loginIdentifier);
      }
      showSignUpError(error as AsynchronousOperationError);
    }
  });

  return {
    control: form.control,
    inputReferences,
    isAccountCreated: loginIdentifier !== undefined,
    isSignUpLoading,
    signUpError: form.formState.errors.root?.signUp?.message,
    submitSignUp,
  };
};

export default useSignUpForm;
