import { Banner, KIND as BANNER_KIND } from "baseui/banner";
import { Block } from "baseui/block";
import { Button, KIND as BUTTON_KIND, SIZE } from "baseui/button";
import { FormControl } from "baseui/form-control";
import { Input } from "baseui/input";
import { ParagraphSmall } from "baseui/typography";
import { useId, type FC } from "react";
import { Controller } from "react-hook-form";

import { RouterLink } from "../../components";
import constant from "../../constants";
import routes from "../../constants/routes";
import useSignUpForm from "./sign-up-form.hook";

const SIGN_UP_FIELDS = [
  {
    name: "firstName",
    label: "First name",
    type: "text",
    autoComplete: "given-name",
    gridColumn: "auto",
    testIdentifier: "first-name",
  },
  {
    name: "lastName",
    label: "Last name",
    type: "text",
    autoComplete: "family-name",
    gridColumn: "auto",
    testIdentifier: "last-name",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
    gridColumn: "1 / -1",
    testIdentifier: "email",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
    gridColumn: "1 / -1",
    testIdentifier: "password",
  },
] as const;

const SignUpForm: FC = () => {
  const formIdentifier = useId();
  const {
    control,
    inputReferences,
    isAccountCreated,
    isSignUpLoading,
    signUpError,
    submitSignUp,
  } = useSignUpForm();

  return (
    <form onSubmit={submitSignUp} noValidate>
      {signUpError && (
        <Block role="alert" data-testid="sign-up-error">
          <Banner
            kind={BANNER_KIND.negative}
            title={
              isAccountCreated ? constant.INCOMPLETE_SIGN_UP_ERROR : undefined
            }
            overrides={{ Root: { props: { "aria-label": "Sign-up error" } } }}
          >
            {signUpError}
          </Banner>
        </Block>
      )}
      <Block
        display="grid"
        gridTemplateColumns={["1fr", "1fr", "1fr 1fr"]}
        gridColumnGap="scale600"
      >
        {SIGN_UP_FIELDS.map(
          ({ autoComplete, gridColumn, label, name, testIdentifier, type }) => (
            <Block key={name} gridColumn={gridColumn}>
              <Controller
                name={name}
                control={control}
                render={({ field, fieldState }) => (
                  <FormControl
                    label={label}
                    htmlFor={`${formIdentifier}-${name}`}
                    caption={fieldState.error?.message}
                    error={Boolean(fieldState.error)}
                    overrides={{
                      Caption: {
                        props: { "data-testid": `${testIdentifier}-error` },
                      },
                    }}
                  >
                    <Input
                      id={`${formIdentifier}-${name}`}
                      name={field.name}
                      type={type}
                      autoComplete={autoComplete}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputRef={inputReferences[name]}
                      disabled={isSignUpLoading}
                      readOnly={isAccountCreated}
                      overrides={{
                        Input: { props: { "data-testid": testIdentifier } },
                      }}
                    />
                  </FormControl>
                )}
              />
            </Block>
          ),
        )}
      </Block>
      <Button
        type="submit"
        kind={BUTTON_KIND.primary}
        size={SIZE.compact}
        isLoading={isSignUpLoading}
        data-testid="continue"
      >
        Continue
      </Button>
      <Block display="flex" flexWrap alignItems="center" marginTop="scale600">
        <ParagraphSmall margin="0">Already have an account?</ParagraphSmall>
        <Button
          href={routes.SIGN_IN}
          kind={BUTTON_KIND.tertiary}
          size={SIZE.compact}
          overrides={{ BaseButton: { props: { $as: RouterLink } } }}
          data-testid="sign-in-link"
        >
          Sign in
        </Button>
      </Block>
    </form>
  );
};

export default SignUpForm;
