import { AuthButton } from "@/app/auth-button";
import { OAuthCard } from "../card";

export default function SignIn() {
  return (
    <OAuthCard
      title="Sign in to connect an app"
      description="An app wants to use R2 Manager on your behalf. Sign in with Hack Club to review what it is asking for."
    >
      <AuthButton signedIn={false} />
    </OAuthCard>
  );
}
