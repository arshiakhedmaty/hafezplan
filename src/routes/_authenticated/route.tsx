import { createFileRoute, isRedirect, Outlet, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { isConnectionError, notifyConnectionIssue } from "@/lib/connection";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        // A network blip must not look like "signed out": keep the locally
        // persisted session and let the page render while the client retries.
        if (isConnectionError(error)) {
          notifyConnectionIssue();
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session?.user) return { user: sessionData.session.user };
        }
        throw redirect({ to: "/auth", search: { redirect: location.pathname } });
      }
      if (!data.user) {
        throw redirect({ to: "/auth", search: { redirect: location.pathname } });
      }
      return { user: data.user };
    } catch (error) {
      if (isRedirect(error)) throw error;
      if (isConnectionError(error)) {
        notifyConnectionIssue();
        const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        if (sessionData.session?.user) return { user: sessionData.session.user };
      }
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
