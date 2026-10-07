import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'en' ? 'en' : 'ne';
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigate(location.state?.from?.pathname || '/app', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || (lang === 'ne' ? 'सर्भरमा जडान गर्न सकिएन' : 'Cannot connect to server'));
    } finally {
      setBusy(false);
    }
  };

  const tx = {
    title: lang === 'ne' ? 'प्रणालीमा लगइन गर्नुहोस्' : 'Login to the system',
    username: lang === 'ne' ? 'प्रयोगकर्ता नाम' : 'Username',
    password: lang === 'ne' ? 'पासवर्ड' : 'Password',
    button: lang === 'ne' ? 'लगइन' : 'Login'
  };

  return (
    <form onSubmit={submit} className="max-w-md mx-auto my-16 bg-white p-8 rounded-lg shadow border-t-4 border-agri-green">
      <h2 className="text-2xl font-bold text-gov-blue mb-6">{tx.title}</h2>
      {error && <div role="alert" className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}
      <label className="block text-sm font-medium mb-1" htmlFor="username">{tx.username}</label>
      <input id="username" className="w-full border rounded p-2 mb-3" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      <label className="block text-sm font-medium mb-1" htmlFor="password">{tx.password}</label>
      <input id="password" type="password" className="w-full border rounded p-2 mb-5" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      <button disabled={busy} className="w-full bg-agri-green hover:bg-green-800 text-white py-2 rounded font-semibold disabled:opacity-60">
        {busy ? '...' : tx.button}
      </button>
    </form>
  );
}
