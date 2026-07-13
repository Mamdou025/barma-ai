// frontend/src/components/ChatBox/UserSelect.jsx
// Lightweight "who is using the app" picker — no login. The chosen profile is
// remembered in localStorage and tagged onto every chat message so we know who
// asked what, without any authentication.
import React, { useEffect, useRef, useState } from 'react';

// The known users. Edit this list to add/remove profiles.
export const USERS = ['Pa Adama Ndour', 'Pa Aly', 'Aziz Diop'];

const STORAGE_KEY = 'barma_user';

// Read/write helpers so other modules can grab the current profile too.
export const getStoredUser = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return USERS.includes(v) ? v : null;
  } catch {
    return null;
  }
};

const storeUser = (name) => {
  try {
    if (name) localStorage.setItem(STORAGE_KEY, name);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
};

const initials = (name) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// value/onChange are optional; when omitted the component manages its own
// localStorage-backed state.
const UserSelect = ({ value, onChange }) => {
  const [internal, setInternal] = useState(() => value ?? getStoredUser());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const current = value !== undefined ? value : internal;

  // Close the menu when clicking outside it.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const select = (name) => {
    const next = name === current ? null : name; // click again to clear
    storeUser(next);
    if (value === undefined) setInternal(next);
    onChange?.(next);
    setOpen(false);
  };

  return (
    <div className="user-select" ref={wrapRef}>
      <button
        type="button"
        className={`user-select-trigger ${current ? 'has-user' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={current ? `Profil : ${current}` : 'Choisir un profil'}
      >
        <span className="user-avatar">{current ? initials(current) : '?'}</span>
        <span className="user-name">{current || 'Qui êtes-vous ?'}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="user-select-menu" role="listbox">
          {USERS.map((name) => (
            <li key={name} role="option" aria-selected={name === current}>
              <button
                type="button"
                className={`user-select-option ${name === current ? 'selected' : ''}`}
                onClick={() => select(name)}
              >
                <span className="user-avatar">{initials(name)}</span>
                {name}
                {name === current && (
                  <svg className="check" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UserSelect;
