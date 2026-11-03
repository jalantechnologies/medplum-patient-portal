import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import constant from "../../constants";
import { useAuthenticationContext } from "../../contexts";
import type { AsynchronousOperationError } from "../../types";

const signInSchema = z.object({
  email: z.email({ error: constant.EMAIL_VALIDATION_ERROR }),
  password: z.string().min(1, { error: constant.PASSWORD_VALIDATION_ERROR }),
});

type SignInFormValues = z.infer<typeof signInSchema>;

const useSignInForm = () => {
  const { isSignInLoading, signIn } = useAuthenticationContext();

  const { control, formState, handleSubmit, setError } =
    useForm<SignInFormValues>({
      resolver: zodResolver(signInSchema),
      defaultValues: {
        email: "",
        password: "",
      },
    });

  const submitSignIn = handleSubmit(async (values) => {
    try {
      await signIn(values.email, values.password);
    } catch (error) {
      setError("root.signIn", {
        message: (error as AsynchronousOperationError).message,
      });
    }
  });

  return {
    control,
    isSignInLoading,
    signInError: formState.errors.root?.signIn?.message,
    submitSignIn,
  };
};

export default useSignInForm;
