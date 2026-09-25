"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Icon, IconButton } from "@/components/ui";
import { AUTH_STATE_COOKIE } from "@/lib/constants";
import { routes } from "@/lib/routes";

function readSignedIn(): boolean {
  return new RegExp(`(?:^|;\\s*)${AUTH_STATE_COOKIE}=1`).test(document.cookie);
}

function subscribe(): () => void {
  // Auth changes always navigate (login/logout redirects), so the
  // per-route remount below is the sync point.
  return () => {};
}

function LiveLink() {
  const signedIn = useSyncExternalStore(subscribe, readSignedIn, () => false);
  if (signedIn) {
    return (
      <IconButton label="Account" href={routes.account()}>
        <Icon name="user" />
      </IconButton>
    );
  }
  return (
    <IconButton label="Sign in" href={routes.login()}>
      <Icon name="user" />
    </IconButton>
  );
}

/**
 * Header account link. Renders from the login-mirror cookie client-side
 * so the header stays static. Display only — route protection always
 * re-validates the httpOnly session on the server.
 */
export function AuthStateLink() {
  const pathname = usePathname();
  return <LiveLink key={pathname} />;
}
