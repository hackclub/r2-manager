import { Suspense } from "react";
import { headers } from "next/headers";
import { Loader } from "@cloudflare/kumo/components/loader";
import { SealCheckIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/lib/auth";
import { getAccess } from "@/lib/access";
import { scopes as catalog, type Scope } from "@/lib/mcp/scopes";
import { AuthButton } from "@/app/auth-button";
import { OAuthCard } from "../card";
import { ConsentForm } from "./form";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const host = (url: string | undefined) => {
  try {
    return url ? new URL(url).host || url : undefined;
  } catch {
    return undefined;
  }
};

async function Consent({ searchParams }: Props) {
  const [access, query] = await Promise.all([getAccess(), searchParams]);
  const param = (k: string) => (typeof query[k] === "string" ? query[k] : undefined);
  const clientId = param("client_id");
  if (!access)
    return (
      <OAuthCard title="Sign in to continue" description="Your session ended before you finished.">
        <AuthButton signedIn={false} />
      </OAuthCard>
    );
  const client =
    clientId &&
    (await auth.api
      .getOAuthClientPublic({ query: { client_id: clientId }, headers: await headers() })
      .catch(() => null));
  if (!client)
    return (
      <OAuthCard
        title="This app could not be found"
        description="The authorization link is incomplete or the app was removed. Start connecting again from the app."
      />
    );
  const name = client.client_name || "An unnamed app";
  const domain = clientId.startsWith("https://") ? host(clientId) : undefined;
  const returnTo = host(param("redirect_uri"));
  const requested = new Set(param("scope")?.split(" "));
  const scopes = Object.keys(catalog).filter((s): s is Scope => requested.has(s));
  return (
    <OAuthCard
      title={`Connect ${name} to R2 Manager`}
      description={
        <>
          <p>
            {name} will act as <strong className="text-kumo-default">{access.user.email}</strong>{" "}
            with your bucket roles. It can never do more than you can.
          </p>
          <p className="mt-3 flex items-start gap-2">
            {domain ? (
              <>
                <SealCheckIcon className="mt-0.5 shrink-0 text-kumo-success" aria-hidden="true" />
                <span>
                  Published by <strong className="text-kumo-default">{domain}</strong>
                </span>
              </>
            ) : (
              <>
                <WarningIcon className="mt-0.5 shrink-0 text-kumo-warning" aria-hidden="true" />
                <span>
                  This app registered itself and its name is unverified. Only continue if you
                  started this connection.
                </span>
              </>
            )}
          </p>
          {returnTo && (
            <p className="mt-3">
              You will return to <strong className="text-kumo-default">{returnTo}</strong>.
            </p>
          )}
        </>
      }
    >
      {access.allowed ? (
        <ConsentForm scopes={scopes} />
      ) : (
        <>
          <p className="mb-4 rounded-lg border border-kumo-line bg-kumo-tint p-3 text-sm">
            Your account does not have access to R2 Manager yet, so there is nothing to connect.
          </p>
          <ConsentForm scopes={[]} denyOnly />
        </>
      )}
    </OAuthCard>
  );
}

export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24">
          <Loader />
        </div>
      }
    >
      <Consent {...props} />
    </Suspense>
  );
}
