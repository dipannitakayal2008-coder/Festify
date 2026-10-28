import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase, supabaseConfigError } from "./supabaseClient.js";
import { AuthContext } from "./authContext.js";
import { isDemoUser } from "./demoAuth.js";

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase));
  const [sessionError, setSessionError] = useState("");
  const [account, setAccount] = useState({
    loading: false,
    error: "",
    profile: null,
    roles: [],
    userId: null,
  });
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setSessionError("");
        if (!nextSession) {
          setAccount({ loading: false, error: "", profile: null, roles: [], userId: null });
        }
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        if (!nextSession) setPasswordRecovery(false);
      }
    );

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setSessionError(error.message);
        setSession(null);
      } else {
        setSession(data.session);
      }
      setSessionLoading(false);
    }).catch((error) => {
      if (!active) return;
      setSessionError(error.message || "Your session could not be restored.");
      setSessionLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;
  const demoUser = isDemoUser(session?.user);

  useEffect(() => {
    if (demoUser || !supabase || !userId) return undefined;

    let active = true;

    async function loadAccount() {
      const [profileResponse, roleResponse] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("*").eq("user_id", userId),
      ]);

      if (!active) return;
      if (profileResponse.error || roleResponse.error) {
        setAccount({
          loading: false,
          error: profileResponse.error?.message || roleResponse.error?.message,
          profile: null,
          roles: [],
          userId,
        });
        return;
      }

      const roles = (roleResponse.data || [])
        .map((row) => normalizeRole(row.role))
        .filter((role) => ["student", "organizer", "admin"].includes(role));

      setAccount({
        loading: false,
        error: "",
        profile: profileResponse.data,
        roles: [...new Set(roles)],
        userId,
      });
    }

    loadAccount().catch((error) => {
      if (!active) return;
      setAccount({
        loading: false,
        error: error.message || "Your Festify profile could not be loaded.",
        profile: null,
        roles: [],
        userId,
      });
    });

    return () => {
      active = false;
    };
  }, [demoUser, userId]);

  const signInDemo = useCallback((demoSession) => {
    if (!isDemoUser(demoSession?.user)) {
      throw new Error("This sign-in session could not be verified.");
    }
    window.history.replaceState({}, "", `/${demoSession.user.app_metadata.role}`);
    setSession(demoSession);
    setSessionError("");
    setAccount({
      loading: false,
      error: "",
      profile: { full_name: demoSession.user.user_metadata.full_name },
      roles: [demoSession.user.app_metadata.role],
      userId: demoSession.user.id,
    });
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoUser(session?.user)) {
      window.history.replaceState({}, "", "/");
      setSession(null);
      setAccount({ loading: false, error: "", profile: null, roles: [], userId: null });
      setPasswordRecovery(false);
      return;
    }
    if (!supabase) throw new Error(supabaseConfigError);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAccount({ loading: false, error: "", profile: null, roles: [], userId: null });
    setPasswordRecovery(false);
  }, [session]);

  const value = useMemo(() => ({
    supabase,
    configured: Boolean(supabase),
    configurationError: supabaseConfigError,
    session,
    sessionLoading,
    sessionError,
    account: demoUser
      ? {
          loading: false,
          error: "",
          profile: { full_name: session.user.user_metadata.full_name },
          roles: [session.user.app_metadata.role],
          userId: session.user.id,
        }
      : {
          ...account,
          loading: account.loading || Boolean(userId && account.userId !== userId),
        },
    passwordRecovery,
    setPasswordRecovery,
    signInDemo,
    signOut,
  }), [
    session,
    sessionLoading,
    sessionError,
    account,
    demoUser,
    userId,
    passwordRecovery,
    signInDemo,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
