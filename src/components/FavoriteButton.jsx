import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { useRouter } from '../routing/Router';
import { addFavorite, removeFavorite } from '../data/favorites';

/**
 * Heart control for favorites. Guests are routed to /login?return=… (never a
 * silent failure); authenticated users toggle the favorite optimistically and
 * revert on API failure.
 */
export default function FavoriteButton({ productId, className = '', initialActive = false }) {
  const { isAuthenticated, token } = useAuth();
  const { copy } = useI18n();
  const { location, navigate } = useRouter();
  const [active, setActive] = useState(Boolean(initialActive));
  const [pending, setPending] = useState(false);

  const handleClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!productId) return;
    if (!isAuthenticated) {
      const returnPath = `${location.pathname}${location.search}`;
      navigate(`/login?return=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (pending) return;
    setPending(true);
    const next = !active;
    setActive(next);
    const result = next ? await addFavorite(productId, token) : await removeFavorite(productId, token);
    if (!result.ok) setActive(!next);
    setPending(false);
  };

  return (
    <button
      type="button"
      className={`favorite-button${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      onClick={handleClick}
      aria-pressed={active}
      aria-label={active ? (copy.favorites?.remove || 'Remove from favorites') : (copy.favorites?.add || 'Add to favorites')}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.3 4.7 13a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l.8.8.8-.8a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5Z" />
      </svg>
    </button>
  );
}