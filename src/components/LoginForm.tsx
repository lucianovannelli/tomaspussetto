import { useState } from 'react';
import type { FormEvent } from 'react';

const STORAGE_KEY = 'ksc_member_id';

export default function LoginForm() {
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedMemberId = memberId.trim();
    const isValid = /^\d+$/.test(normalizedMemberId);

    if (!isValid) {
      setError('Ingresá un ID numérico válido.');
      return;
    }

    localStorage.setItem(STORAGE_KEY, normalizedMemberId);
    window.location.href = `/dashboard?member_id=${encodeURIComponent(normalizedMemberId)}`;
  };

  return (
    <form onSubmit={handleSubmit} className="surface-card flex flex-col gap-4" aria-label="Formulario de acceso">
      <div className="space-y-1">
        <label htmlFor="member-id" className="block text-base font-semibold text-slate-900">
          ID de socio
        </label>
        <input
          id="member-id"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="touch-input"
          placeholder="Ej: 42"
          value={memberId}
          onChange={(event) => {
            setMemberId(event.target.value);
            setError('');
          }}
          required
        />
      </div>

      {error ? <p className="text-base font-medium text-red-700">{error}</p> : null}

      <button type="submit" className="login-btn">
          <span className="btn-text">Ingresar</span>
        </button>
    </form>
  );
}
