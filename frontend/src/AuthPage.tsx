import { useState, type FormEvent } from "react";
import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import "./AuthPage.css";

import { useAuth } from "./auth/useAuth";

type AuthPageProps = {
  mode: "login" | "register";
};

export default function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);

      if (isRegister) {
        await register({ displayName, email, password });
      } else {
        await login({ email, password });
      }

      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mainContainer">
      <div className="authHeader">
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p>
          {isRegister
            ? "Create an account to start using the application."
            : "Sign in to continue to your dashboard."}
        </p>
      </div>

      <form className="authCard" onSubmit={handleSubmit}>
        {isRegister && (
          <label className="authField">
            <span>Display name</span>
            <span className="authInputGroup">
              <UserRound aria-hidden="true" size={21} strokeWidth={2} />
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
                minLength={2}
                maxLength={50}
                placeholder="Enter your name"
                required
                autoFocus
              />
            </span>
          </label>
        )}

        <label className="authField">
          <span>Email address</span>
          <span className="authInputGroup">
            <Mail aria-hidden="true" size={21} strokeWidth={2} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              maxLength={254}
              placeholder="Enter your email"
              required
              autoFocus={!isRegister}
            />
          </span>
        </label>

        <label className="authField">
          <span>Password</span>
          <span className="authInputGroup">
            <LockKeyhole aria-hidden="true" size={21} strokeWidth={2} />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 8 : undefined}
              maxLength={128}
              placeholder="Enter your password"
              required
            />
            <button
              className="passwordToggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </span>
        </label>

        {isRegister && (
          <label className="authField">
            <span>Confirm password</span>
            <span className="authInputGroup">
              <LockKeyhole aria-hidden="true" size={21} strokeWidth={2} />
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                placeholder="Enter your password again"
                required
              />
            </span>
          </label>
        )}

        {error && <p className="authError" role="alert">{error}</p>}

        <button className="authSubmit" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isRegister
              ? "Creating account..."
              : "Signing in..."
            : isRegister
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="authFooter">
        {isRegister ? "Already have an account?" : "Need an account?"}{" "}
        <Link to={isRegister ? "/login" : "/register"}>
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </main>
  );
}
