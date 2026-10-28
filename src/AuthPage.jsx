import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { signInDemo } from "./lib/demoAuth.js";
import "./AuthPage.css";

const roleOptions = [
  { id: "student", title: "Student", description: "Discover campus events and earn rewards." },
  { id: "organizer", title: "Organizer", description: "Create events and manage attendance." },
  { id: "admin", title: "Admin", description: "Review and approve event submissions." },
];

export default function AuthPage({ initialRole = "student", onLogin }) {
  const [role, setRole] = useState(roleOptions.some((item) => item.id === initialRole) ? initialRole : "student");
  const [campusId, setCampusId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const chooseRole = (nextRole) => {
    setRole(nextRole);
    setCampusId("");
    setPassword("");
    setError("");
  };

  const submit = (event) => {
    event.preventDefault();
    setError("");
    const account = signInDemo(campusId.trim(), password, role);
    if (!account) {
      setError(`The ${role} ID or password is incorrect. Check your credentials and try again.`);
      return;
    }
    onLogin(account);
  };

  const selectedRole = roleOptions.find((item) => item.id === role);

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />
      <header className="auth-header">
        <a className="auth-brand" href="/" aria-label="Festify home">
          <span className="auth-brand-mark"><Sparkles size={21} /></span>
          <span>festify<span className="auth-brand-period">.</span></span>
        </a>
        <span className="auth-header-note"><LockKeyhole size={14} /> CAMPUS EVENTS · CAMPUS ID SIGN-IN</span>
      </header>

      <section className="auth-layout">
        <div className="auth-story">
          <span className="auth-kicker"><span /> THE OPERATING SYSTEM FOR CAMPUS EVENTS</span>
          <h1>Your campus.<br />Your community.<br /><span>Your next big moment.</span></h1>
          <p>Students discover what's happening. Organizers bring it to life. Administrators keep every event moving.</p>
          <div className="auth-story-note">
            <span className="auth-note-icon"><Sparkles size={17} /></span>
            <span><strong>One campus, endless possibilities.</strong><small>Sign in to your campus workspace.</small></span>
          </div>
        </div>

        <section className="auth-card" aria-labelledby="login-heading">
          <div className="auth-card-heading">
            <span className="auth-card-icon"><Fingerprint size={18} /></span>
            <span>CHOOSE YOUR WORKSPACE</span>
          </div>
          <h2 id="login-heading">Welcome to Festify.</h2>
          <p className="auth-card-description">Select your section, then sign in with its campus ID and password.</p>

          <div className="auth-role-tabs" role="tablist" aria-label="Login section">
            {roleOptions.map((option) => (
              <button
                type="button"
                role="tab"
                id={`login-tab-${option.id}`}
                aria-selected={role === option.id}
                aria-controls="role-login-panel"
                className={`auth-role-tab${role === option.id ? " active" : ""}`}
                key={option.id}
                onClick={() => chooseRole(option.id)}
              >
                {option.title}
              </button>
            ))}
          </div>

          <div id="role-login-panel" role="tabpanel" aria-labelledby={`login-tab-${role}`}>
            <p className="auth-role-description">{selectedRole.description}</p>
            {error && <div className="auth-message error" role="alert">{error}</div>}
            <form className="auth-form" onSubmit={submit}>
              <label className="auth-field">
                <span>{role === "student" ? "Student ID" : role === "organizer" ? "Organizer ID" : "Admin ID"}</span>
                <input
                  type="text"
                  name="campus-id"
                  autoComplete="username"
                  value={campusId}
                  onChange={(event) => setCampusId(event.target.value)}
                  placeholder={`Enter your ${role} ID`}
                  maxLength={64}
                  required
                />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <span className="auth-password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    className="auth-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
              <button className="auth-submit" type="submit">
                <span>Sign in as {selectedRole.title}</span><ArrowRight size={17} />
              </button>
            </form>
          </div>
          <div className="auth-card-footer"><span /> Local sign-in · credentials are not sent to a server <span /></div>
        </section>
      </section>
      <footer className="auth-footer">FESTIFY <span>·</span> DISCOVER. ORGANIZE. BELONG.</footer>
    </main>
  );
}
