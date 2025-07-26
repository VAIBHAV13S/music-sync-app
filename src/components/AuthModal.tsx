import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState(initialMode);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          return;
        }
        
        const result = await register(formData.username, formData.email, formData.password);
        if (result.success) {
          onClose();
        } else {
          setError(result.error || 'Registration failed');
        }
      } else {
        const result = await login(formData.email || formData.username, formData.password);
        if (result.success) {
          onClose();
        } else {
          setError(result.error || 'Login failed');
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-6">
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl p-8 w-full max-w-lg shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-6">
          <h2 className="text-3xl font-semibold text-white">{mode === 'login' ? 'Sign In' : 'Register'}</h2>
          <p className="text-zinc-400 text-sm mt-1">
            {mode === 'login' ? 'Access your account' : 'Join the platform today'}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2 bg-red-600/10 text-red-400 text-sm border border-red-500/20 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'register' && (
            <div>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Username"
              />
            </div>
          )}

          <div>
            <input
              type={mode === 'login' ? 'text' : 'email'}
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder={mode === 'login' ? 'Email or Username' : 'Email'}
            />
          </div>

          <div>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Password"
            />
          </div>

          {mode === 'register' && (
            <div>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-md text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Confirm Password"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 text-white font-medium rounded-md transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {mode === 'login' ? 'Signing in...' : 'Registering...'}
              </div>
            ) : (
              mode === 'login' ? 'Sign In' : 'Register'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-400">
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-blue-400 hover:underline font-medium"
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}