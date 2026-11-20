import { Banner, KIND as BANNER_KIND } from "baseui/banner";
import { Block } from "baseui/block";
import { Button, KIND as BUTTON_KIND, SIZE } from "baseui/button";
import { FormControl } from "baseui/form-control";
import { Input } from "baseui/input";
import { ParagraphSmall } from "baseui/typography";
import { useId, type FC } from "react";
import { Controller } from "react-hook-form";

import { RouterLink } from "../../components";
import { configuration } from "../../configuration";
import routes from "../../constants/routes";
import useSignInForm from "./sign-in-form.hook";

const SignInForm: FC = () => {
  const emailIdentifier = useId();
  const passwordIdentifier = useId();
  const { control, isSignInLoading, signInError, submitSignIn } =
    useSignInForm();

  return (
    <form onSubmit={submitSignIn} noValidate>
      {signInError && (
        <Block role="alert" data-testid="sign-in-error">
          <Banner
            kind={BANNER_KIND.negative}
            overrides={{ Root: { props: { "aria-label": "Sign-in error" } } }}
          >
            {signInError}
          </Banner>
        </Block>
      )}
      <Controller
        name="email"
        control={control}
        render={({ field, fieldState }) => (
          <FormControl
            label="Email"
            htmlFor={emailIdentifier}
            caption={fieldState.error?.message}
            error={Boolean(fieldState.error)}
            overrides={{ Caption: { props: { "data-testid": "email-error" } } }}
          >
            <Input
              id={emailIdentifier}
              name={field.name}
              type="email"
              autoComplete="email"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={isSignInLoading}
              overrides={{ Input: { props: { "data-testid": "email" } } }}
            />
          </FormControl>
        )}
      />
      <Controller
        name="password"
        control={control}
        render={({ field, fieldState }) => (
          <FormControl
            label="Password"
            htmlFor={passwordIdentifier}
            caption={fieldState.error?.message}
            error={Boolean(fieldState.error)}
            overrides={{
              Caption: { props: { "data-testid": "password-error" } },
            }}
          >
            <Input
              id={passwordIdentifier}
              name={field.name}
              type="password"
              autoComplete="current-password"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={isSignInLoading}
              overrides={{ Input: { props: { "data-testid": "password" } } }}
            />
          </FormControl>
        )}
      />
      <Button
        type="submit"
        kind={BUTTON_KIND.primary}
        size={SIZE.compact}
        isLoading={isSignInLoading}
        data-testid="sign-in"
      >
        Sign in
      </Button>
      {configuration.isSignUpEnabled && (
        <Block display="flex" flexWrap alignItems="center" marginTop="scale600">
          <ParagraphSmall margin="0">Don't have an account?</ParagraphSmall>
          <Button
            href={routes.SIGN_UP}
            kind={BUTTON_KIND.tertiary}
            size={SIZE.compact}
            overrides={{ BaseButton: { props: { $as: RouterLink } } }}
            data-testid="create-account-link"
          >
            Create your account
          </Button>
        </Block>
      )}
    </form>
  );
};

export default SignInForm;
