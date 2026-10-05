import React from "react";
import { useRouter } from "next/router";
import { ConfigProvider, Result, Spin } from "antd";
import { Authenticator } from "@aws-amplify/ui-react";
import { mutate } from "swr";

import "@aws-amplify/ui-react/styles.css";
import "@/shared/lib/amplify";
import theme from "@/theme/themeConfig";
import "@/styles/globals.css";
import { AppLayout } from "@/shared/ui/core/ui/layout";
import { canAccess } from "@/shared/lib/access";
import useCurrentUser from "@/shared/lib/use-current-user";
import useMyTeacher from "@/entities/teacher/lib/use-my-teacher";
import EnsureInitialData from "@/components/EnsureInitialData";

// Users can sign in with their username or, if they have one, their email.
const SIGN_IN_FORM_FIELDS = {
  signIn: {
    username: {
      label: "Username or email",
      placeholder: "Enter your username or email",
    },
  },
  forgotPassword: {
    username: {
      label: "Username or email",
      placeholder: "Enter your username or email",
    },
  },
};

function SignedInApp({ Component, pageProps, signOut }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { isCoordinator } = useMyTeacher();

  // Clear cached data so the next account to sign in starts fresh.
  const onSignOut = () => {
    mutate(() => true, undefined, { revalidate: false });
    signOut();
  };

  let content = <Component {...pageProps} />;
  if (currentUser.isLoading) {
    content = <Spin style={{ display: "block", margin: "4rem auto" }} />;
  } else if (!currentUser.isAdmin && !currentUser.isTeacher) {
    content = (
      <Result
        status="403"
        title="No role assigned"
        subTitle="Ask an administrator to give your account the Admin or Teacher role."
      />
    );
  } else if (!canAccess(router.pathname, currentUser)) {
    content = (
      <Result
        status="403"
        title="Admins only"
        subTitle="You don't have access to this page."
      />
    );
  }

  return (
    <AppLayout
      onSignOut={onSignOut}
      currentUser={{ ...currentUser, isCoordinator }}
    >
      {currentUser.isAdmin && <EnsureInitialData />}
      {content}
    </AppLayout>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <ConfigProvider theme={theme}>
      {/* Users are created by an administrator, so sign-up is hidden. */}
      <Authenticator
        hideSignUp
        variation="modal"
        formFields={SIGN_IN_FORM_FIELDS}
      >
        {({ signOut }) => (
          <SignedInApp
            Component={Component}
            pageProps={pageProps}
            signOut={signOut}
          />
        )}
      </Authenticator>
    </ConfigProvider>
  );
}
