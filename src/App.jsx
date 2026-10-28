import { useEffect, useState } from "react";
import AuthPage from "./AuthPage.jsx";
import Dashboard from "./Dashboard.jsx";

const roles = ["student", "organizer", "admin"];
const accountNames = {
  student: "Student",
  organizer: "Organizer",
  admin: "Administrator",
};

function roleFromPath() {
  const requestedRole = window.location.pathname.replace(/\/$/, "").slice(1);
  return roles.includes(requestedRole) ? requestedRole : "student";
}

export default function App() {
  const [role, setRole] = useState(null);
  const [loginRole, setLoginRole] = useState(roleFromPath);

  useEffect(() => {
    const handleHistoryChange = () => {
      if (!role) setLoginRole(roleFromPath());
    };
    window.addEventListener("popstate", handleHistoryChange);
    return () => window.removeEventListener("popstate", handleHistoryChange);
  }, [role]);

  const logIn = (session) => {
    const nextRole = session.user.app_metadata.role;
    setRole(nextRole);
    window.history.replaceState({}, "", `/${nextRole}`);
  };

  const logOut = () => {
    setRole(null);
    setLoginRole("student");
    window.history.pushState({}, "", "/");
  };

  if (!role) return <AuthPage key={loginRole} initialRole={loginRole} onLogin={logIn} />;

  const user = { id: `demo-${role}`, user_metadata: { full_name: accountNames[role] } };
  const profile = { full_name: accountNames[role] };
  return (
    <Dashboard
      key={role}
      role={role}
      user={user}
      profile={profile}
      onLogOut={logOut}
    />
  );
}
