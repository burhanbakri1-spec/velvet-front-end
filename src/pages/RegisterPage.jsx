import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath, useRouter } from '../routing/Router';

export default function RegisterPage() {
  const { copy, locale } = useI18n();
  const { register, authConfigured, isAuthenticated } = useAuth();
  const { navigate } = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(false);

  const returnPath = new URLSearchParams(window.location.search).get('return') || '';

  useEffect(() => {
    if (isAuthenticated) navigate(localizePath(returnPath || '/account', locale));
  }, [isAuthenticated, locale, navigate, returnPath]);

  const setField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);
    if (form.password !== form.confirmPassword) {
      setStatus({ tone: 'error', message: copy.register.passwordMismatch });
      return;
    }
    setPending(true);
    try {
      const result = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      if (result.ok) {
        navigate(localizePath(returnPath || '/account', locale));
        return;
      }
      setStatus({
        tone: 'info',
        message: result.code === 'AUTH_NOT_CONFIGURED'
          ? copy.register.unavailableBody
          : (result.message || copy.register.error),
      });
    } catch {
      setStatus({ tone: 'error', message: copy.register.error });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-panel" aria-labelledby="register-title">
        <span className="store-eyebrow">{copy.register.eyebrow}</span>
        <h1 id="register-title">{copy.register.title}</h1>
        <p className="auth-panel__intro">{copy.register.intro}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>{copy.register.name}</span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              required
              value={form.name}
              onChange={setField('name')}
              placeholder={copy.register.namePlaceholder}
            />
          </label>
          <label>
            <span>{copy.register.email}</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              dir="ltr"
              required
              value={form.email}
              onChange={setField('email')}
              placeholder={copy.register.emailPlaceholder}
            />
          </label>
          <label>
            <span>{copy.register.phone}</span>
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              dir="ltr"
              required
              value={form.phone}
              onChange={setField('phone')}
              placeholder={copy.register.phonePlaceholder}
            />
          </label>
          <label>
            <span>{copy.register.password}</span>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              required
              minLength={6}
              value={form.password}
              onChange={setField('password')}
              placeholder={copy.register.passwordPlaceholder}
            />
          </label>
          <label>
            <span>{copy.register.confirmPassword}</span>
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              required
              value={form.confirmPassword}
              onChange={setField('confirmPassword')}
              placeholder={copy.register.confirmPasswordPlaceholder}
            />
          </label>
          <div className="auth-form__actions">
            <button className="store-primary-button" type="submit" disabled={pending}>
              {pending ? copy.register.submitting : copy.register.submit}
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
          <p className="auth-panel__note">{copy.register.unavailableNote}</p>
        ) : null}

        <p className="auth-panel__footer">
          <Link to="/login">{copy.register.signInInstead}</Link>
          {' · '}
          <Link to="/">{copy.register.backHome}</Link>
        </p>
      </section>
    </div>
  );
}