import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";
import { useAuth } from "./lib/useAuth.js";
import "./AuthPage.css";

function authErrorMessage(error) {
  const message = String(error?.message || "");
  const normalized = message.toLowerCase();

  if (!navigator.onLine || /fetch|network|timeout|failed to connect/.test(normalized)) {
    return "We couldn't reach Supabase. Check your connection and project URL, then try again.";
  }
  if (/email not confirmed/.test(normalized)) {
    return "Please verify your email before signing in. You can resend the confirmation email below.";
  }
  if (/invalid api key|invalid jwt/.test(normalized)) {
    return "Supabase rejected this public key. Check that the project URL and publishable key (or legacy anon key) belong to the same project.";
  }
  if (/invalid login credentials/.test(normalized)) {
    return "That email and password combination wasn't recognized. Check your details or reset your password.";
  }
  if (/user already registered/.test(normalized)) {
    return "An account already exists for this email. Sign in or reset your password instead.";
  }
  return message || "That request couldn't be completed. Please try again.";
}

export default function AuthPage({ sessionError = "" }) {
  const {
    supabase,
    configurationError,
    passwordRecovery,
    setPasswordRecovery,
  } = useAuth();
  const [screenMode, setScreenMode] = useState("signin");
  const mode = passwordRecovery ? "update-password" : screenMode;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");

  const changeMode = (nextMode) => {
    setScreenMode(nextMode);
    setError("");
    setMessage("");
    setPassword("");
    setConfirmPassword("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!supabase) {
      setError(configurationError);
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Your passwords don't match.");
      return;
    }
    if (["signup", "update-password"].includes(mode) && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          setMessage("Your account is ready. Welcome to Festify!");
        } else {
          setVerificationEmail(email.trim());
          setMessage("Account created. Check your inbox to verify your email before signing in.");
        }
      } else if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        setMessage("Signed in successfully. Loading your campus space…");
      } else if (mode === "reset") {
        const redirectTo = new URL("/", window.location.origin).toString();
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo }
        );
        if (resetError) throw resetError;
        setMessage("If an account exists for that email, a password reset link is on its way.");
      } else {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setPasswordRecovery(false);
        changeMode("signin");
        setMessage("Password updated. You can now sign in with your new password.");
      }
    } catch (requestError) {
      if (mode === "signin" && /email not confirmed/i.test(requestError?.message || "")) {
        setVerificationEmail(email.trim());
      }
      setError(authErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!supabase || !verificationEmail || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: verificationEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (resendError) throw resendError;
      setMessage("A new verification email has been sent.");
    } catch (requestError) {
      setError(authErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const title = {
    signin: "Welcome back.",
    signup: "Find your people.",
    reset: "Reset your password.",
    "update-password": "Choose a new password.",
  }[mode];

  const description = {
    signin: "Your next campus moment is closer than you think.",
    signup: "Join the community making campus life happen.",
    reset: "We'll email you a secure link to get back into your account.",
    "update-password": "Create a new password for your Festify account.",
  }[mode];

  return (
    <main className="auth-page">
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />
      <header className="auth-header">
        <a className="auth-brand" href="/" aria-label="Festify home">
          <span className="auth-brand-mark"><Sparkles size={21} /></span>
          <span>festify<span className="auth-brand-period">.</span></span>
        </a>
        <span className="auth-header-note"><LockKeyhole size={14} /> YOUR CAMPUS, CONNECTED</span>
      </header>

      <section className="auth-layout">
        <div className="auth-story">
          <span className="auth-kicker"><span /> THE OPERATING SYSTEM FOR CAMPUS EVENTS</span>
          <h1>Your campus.<br />Your community.<br /><span>Your next big moment.</span></h1>
          <p>Students discover what's happening. Organizers bring it to life. Administrators keep every event moving.</p>
          <div className="auth-story-note">
            <span className="auth-note-icon"><Sparkles size={17} /></span>
            <span><strong>One campus, endless possibilities.</strong><small>Find your next reason to show up.</small></span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-heading">
            <span className="auth-card-icon"><Mail size={18} /></span>
            <span>FESTIFY ACCOUNT</span>
          </div>
          <h2>{title}</h2>
          <p className="auth-card-description">{description}</p>

          {configurationError && (
            <div className="auth-message error" role="alert">
              <strong>Supabase setup needed</strong>
              <span>{configurationError}</span>
            </div>
          )}
          {sessionError && <div className="auth-message error" role="alert">Your saved session could not be restored: {sessionError}</div>}
          {error && <div className="auth-message error" role="alert">{error}</div>}
          {message && <div className="auth-message success" role="status">{message}</div>}

          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <label className="auth-field">
                <span>Full name</span>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  required
                />
              </label>
            )}

            {mode !== "update-password" && (
              <label className="auth-field">
                <span>Email address</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@campus.edu"
                  required
                />
              </label>
            )}

            {mode !== "reset" && (
              <label className="auth-field">
                <span>{mode === "update-password" ? "New password" : "Password"}</span>
                <span className="auth-password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    name={mode === "update-password" ? "new-password" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "signin" ? "Enter your password" : "At least 8 characters"}
                    minLength={mode === "signin" ? undefined : 8}
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
            )}

            {mode === "signup" && (
              <label className="auth-field">
                <span>Confirm password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter your password again"
                  minLength={8}
                  required
                />
              </label>
            )}

            {mode === "signin" && (
              <div className="auth-form-options">
                <span className="auth-session-note"><LockKeyhole size={13} /> Session securely restored by Supabase</span>
                <button type="button" className="auth-text-button" onClick={() => changeMode("reset")}>Forgot password?</button>
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={busy || Boolean(configurationError)}>
              {busy ? <span className="auth-spinner" aria-hidden="true" /> : null}
              <span>
                {busy ? "Please wait…" : {
                  signin: "Sign in",
                  signup: "Create account",
                  reset: "Send reset link",
                  "update-password": "Update password",
                }[mode]}
              </span>
              {!busy && <ArrowRight size={17} />}
            </button>
          </form>

          {verificationEmail && ["signin", "signup"].includes(mode) && (
            <button className="auth-resend" type="button" onClick={resendVerification} disabled={busy}>
              Resend verification email
            </button>
          )}

          {mode === "signin" ? (
            <p className="auth-switch">New to campus? <button type="button" onClick={() => changeMode("signup")}>Create an account</button></p>
          ) : mode === "signup" ? (
            <p className="auth-switch">Already part of Festify? <button type="button" onClick={() => changeMode("signin")}>Sign in</button></p>
          ) : (
            <p className="auth-switch"><button type="button" onClick={() => { setPasswordRecovery(false); changeMode("signin"); }}>Back to sign in</button></p>
          )}
          <div className="auth-card-footer"><span /> Secure sign-in powered by Supabase <span /></div>
        </div>
      </section>
      <footer className="auth-footer">FESTIFY <span>·</span> DISCOVER. ORGANIZE. BELONG.</footer>
    </main>
  );
}
