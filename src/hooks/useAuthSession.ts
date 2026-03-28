import { authClient } from "@/lib/auth-client";

export function useAuthSession() {
  const { data: session, isPending: isLoading } = authClient.useSession();

  return {
    user: session?.user ?? null,
    session: session ?? null,
    isLoading,
  };
}
