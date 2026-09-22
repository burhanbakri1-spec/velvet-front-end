import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Link, localizePath, useRouter } from '../routing/Router';

export default function AccountPage() {
  const { copy, locale } = useI18n();
  const { isAuthenticated, customer, logout, authConfigured } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate(localizePath('/login', locale));
    }
  }, [isAuthenticated, locale, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="auth-page">
        <section className="auth-panel" aria-labelledby="account-title">
          <span className="store-eyebrow">{copy.account.eyebrow}</span>
          <h1 id="account-title">{copy.account.title}</h1>
          <p className="auth-panel__intro">{copy.account.redirecting}</p>
          <p className="auth-panel__footer">
            <Link to="/login">{copy.account.signIn}</Link>
          </p>
        </section>
      </div>
    );
  }

  const displayName = customer?.name || customer?.email || copy.account.member;

  return (
    <div className="auth-page">
      <section className="auth-panel" aria-labelledby="account-title">
        <span className="store-eyebrow">{copy.account.eyebrow}</span>
        <h1 id="account-title">{copy.account.title}</h1>
        <p className="auth-panel__intro">
          {copy.account.welcome.replace('{name}', displayName)}
        </p>
        {!authConfigured ? (
          <p className="auth-panel__note">{copy.login.unavailableNote}</p>
        ) : null}
        <div className="auth-form__actions">
          <button
            className="store-primary-button"
            type="button"
            onClick={() => {
              logout();
              navigate(localizePath('/login', locale));
            }}
          >
            {copy.account.signOut}
            <i>{locale === 'ar' ? '←' : '→'}</i>
          </button>
        </div>
        <p className="auth-panel__footer">
          <Link to="/">{copy.login.backHome}</Link>
        </p>
      </section>
    </div>
  );
}
