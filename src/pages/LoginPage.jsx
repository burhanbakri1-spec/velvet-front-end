import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath, useRouter } from '../routing/Router';

export default function LoginPage() {
  const { copy, locale } = useI18n();
  const { login, authConfigured, isAuthenticated } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(false);

  const returnPath = new URLSearchParams(window.location.search).get('return') || '';

  useEffect(() => {
    if (isAuthenticated) navigate(localizePath(returnPath || '/account', locale));
  }, [isAuthenticated, locale, navigate, returnPath]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    setPending(true);
    try {
      const result = await login({ email, password });
      if (result.ok) {
        navigate(localizePath(returnPath || '/account', locale));
        return;
      }
      setStatus({
        tone: 'info',
        message: result.code === 'AUTH_NOT_CONFIGURED'
          ? copy.login.unavailableBody
          : (result.message || copy.login.error),
      });
    } catch {
      setStatus({ tone: 'error', message: copy.login.error });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-brand" aria-hidden="true">
          <span className="auth-brand__mark">VELVET</span>
          <p className="auth-brand__line">{copy.login.brandLine}</p>
        </aside>

        <section className="auth-panel auth-card" aria-labelledby="login-title">
          <span className="store-eyebrow">{copy.login.eyebrow}</span>
          <h1 id="login-title">{copy.login.title}</h1>
          <p className="auth-panel__intro">{copy.login.intro}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              <span>{copy.login.email}</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={copy.login.emailPlaceholder}
              />
            </label>
            <label>
              <span>{copy.login.password}</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={copy.login.passwordPlaceholder}
              />
            </label>
            <div className="auth-form__actions">
              <button className="store-primary-button" type="submit" disabled={pending}>
                {pending ? copy.login.submitting : copy.login.submit}
                <i>{locale === 'ar' ? '←' : '→'}</i>
              </button>
            </div>
          </form>

          {status ? (
            <p className={`auth-panel__status auth-panel__status--${status.tone}`} role="status">
              {status.message}
            </p>
          ) : null}

          {!authConfigured ? (
            <p className="auth-panel__note">{copy.login.unavailableNote}</p>
          ) : null}

          <p className="auth-panel__footer">
            <Link to="/register">{copy.login.createAccount}</Link>
            <span className="auth-panel__sep" aria-hidden="true">·</span>
            <Link to="/">{copy.login.backHome}</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
