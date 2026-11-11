"use client";
import { Button } from "@cloudflare/kumo/components/button";
import { authClient } from "@/lib/auth-client";

export function AuthButton({ signedIn }: { signedIn: boolean }) {
  return (
    <Button
      variant={signedIn ? "secondary" : "primary"}
      onClick={async () => {
        if (!signedIn) return authClient.signIn.social({ provider: "hackclub", callbackURL: "/" });
        await authClient.signOut();
        window.location.reload();
      }}
    >
      {signedIn ? "Sign out" : "Sign in with Hack Club"}
    </Button>
  );
}
