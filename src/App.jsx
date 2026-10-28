import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import AuthPage from "./AuthPage.jsx";
import Dashboard from "./Dashboard.jsx";
import { AuthProvider } from "./lib/AuthContext.jsx";
import { useAuth } from "./lib/useAuth.js";
import "./AuthPage.css";

const routeRoles = {
  "/student": "student",
  "/organizer": "organizer",
  "/admin": "admin",
};

function routeForRole(role) {
  return `/${role}`;
}

function LoadingScreen({ message }) {
  return (
    <main className="auth-loading-screen" role="status">
      <span className="auth-loading-mark"><Sparkles size={21} /></span>
      <span className="auth-spinner" />
      <p>{message}</p>
    </main>
  );
}

function AccountMessage({ title, message, action, onAction }) {
  const [actionError, setActionError] = useState("");

  const runAction = async () => {
    setActionError("");
    try {
      await onAction();
    } catch (error) {
      setActionError(error.message || "That action could not be completed.");
    }
  };

  return (
    <main className="account-message-page">
      <div className="account-message-card">
        <span className="auth-card-icon"><LockKeyhole size={19} /></span>
        <span className="auth-kicker">FESTIFY ACCOUNT</span>
        <h1>{title}</h1>
        <p>{message}</p>
        {actionError && <div className="auth-message error" role="alert">{actionError}</div>}
        {action && <button className="auth-submit" type="button" onClick={runAction}>{action}<ArrowRight size={17} /></button>}
      </div>
    </main>
  );
}

function AuthenticatedApp() {
  const {
    session,
    sessionLoading,
    sessionError,
    account,
    passwordRecovery,
    signOut,
  } = useAuth();

  const roles = account.roles;
  const defaultRole = ["admin", "organizer", "student"].find((role) => roles.includes(role));
  const requestedRole = routeRoles[window.location.pathname.replace(/\/$/, "")];

  useEffect(() => {
    if (defaultRole && !requestedRole && window.location.pathname !== routeForRole(defaultRole)) {
      window.history.replaceState({}, "", routeForRole(defaultRole));
    }
  }, [defaultRole, requestedRole]);

  if (sessionLoading) return <LoadingScreen message="Restoring your secure session…" />;

  if (!session) return <AuthPage sessionError={sessionError} />;

  if (passwordRecovery) return <AuthPage sessionError="" />;

  if (account.loading) return <LoadingScreen message="Loading your Festify profile…" />;

  if (account.error) {
    return (
      <AccountMessage
        title="Your profile couldn't be loaded."
        message={`Festify couldn't retrieve your profile and authorized roles: ${account.error}`}
        action="Sign out"
        onAction={signOut}
      />
    );
  }

  if (!account.profile) {
    return (
      <AccountMessage
        title="Your profile is not ready yet."
        message="No profile record was returned for this account. New profiles must be created by the existing secure Supabase profile trigger. Contact your administrator to check that backend setup; Festify will not create or assign roles from the browser."
        action="Sign out"
        onAction={signOut}
      />
    );
  }

  if (!defaultRole) {
    return (
      <AccountMessage
        title="No campus role is assigned."
        message="Your account doesn't have an authorized student, organizer, or administrator role. New users should receive the student role from the secure backend setup. Ask an administrator to review your account; you cannot assign roles to yourself."
        action="Sign out"
        onAction={signOut}
      />
    );
  }

  if (requestedRole && !roles.includes(requestedRole)) {
    return (
      <AccountMessage
        title="You don't have access to this workspace."
        message={`This page requires the ${requestedRole} role. Your authorized role${roles.length === 1 ? " is" : "s are"} ${roles.join(", ")}.`}
        action={`Open your ${defaultRole} workspace`}
        onAction={() => window.location.assign(routeForRole(defaultRole))}
      />
    );
  }

  const activeRole = requestedRole || defaultRole;

  return <Dashboard role={activeRole} user={session.user} profile={account.profile} onSignOut={signOut} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
