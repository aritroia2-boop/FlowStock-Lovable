import { useState } from 'react';
import { Mail, Lock, ShoppingCart, User, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authService } from '../lib/auth';

export const LoginPage = () => {
  const { setCurrentPage, setCurrentUser, connectionError } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [signUpData, setSignUpData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loginError, setLoginError] = useState('');
  const [signUpError, setSignUpError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoginLoading(true);

    try {
      await authService.login({ email, password });
      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      setCurrentPage('dashboard');
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError('');

    if (signUpData.password !== signUpData.confirmPassword) {
      setSignUpError('Passwords do not match');
      return;
    }

    if (signUpData.password.length < 6) {
      setSignUpError('Password must be at least 6 characters');
      return;
    }

    setIsSignUpLoading(true);

    try {
      await authService.signUp({
        name: signUpData.name,
        email: signUpData.email,
        password: signUpData.password,
      });

      const user = await authService.getCurrentUser();
      setCurrentUser(user);
      setShowSignUpModal(false);
      setSignUpData({ name: '', email: '', password: '', confirmPassword: '' });
      setCurrentPage('dashboard');
    } catch (error: any) {
      console.error('Sign up error:', error);
      setSignUpError(error.message || 'Failed to create account. Please try again.');
    } finally {
      setIsSignUpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-cyan-100 flex items-center justify-center p-6">
      <div className="relative w-full max-w-5xl">
        <div className="absolute -top-4 -left-4 w-64 h-64 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-4 -right-4 w-64 h-64 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full opacity-20 blur-3xl"></div>

        <div className="relative bg-white rounded-3xl shadow-2xl p-16 flex items-center gap-16">
          <div className="flex-1 flex flex-col items-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-xl opacity-50"></div>
              <div className="relative bg-gradient-to-br from-blue-500 to-cyan-400 p-8 rounded-full">
                <ShoppingCart size={64} className="text-white" strokeWidth={2.5} />
              </div>
            </div>

            <h1 className="text-5xl font-bold mb-2">
              <span className="text-gray-900">Flow</span>
              <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">Stock</span>
            </h1>
          </div>

          <div className="flex-1">
            <h2 className="text-4xl font-bold text-gray-900 mb-8">Welcome Back!</h2>

            <form onSubmit={handleLogin} className="space-y-6">
              {connectionError && (
                <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
                  <AlertCircle size={20} className="text-yellow-600 flex-shrink-0" />
                  <p className="text-yellow-700 text-sm">{connectionError}</p>
                </div>
              )}
              {loginError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{loginError}</p>
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-purple-400 transition-colors text-gray-700 placeholder-gray-400"
                  required
                  disabled={isLoginLoading}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-purple-400 transition-colors text-gray-700 placeholder-gray-400"
                  required
                  disabled={isLoginLoading}
                />
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              </div>

              <button
                type="submit"
                disabled={isLoginLoading}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoginLoading ? 'Logging in...' : 'Log In'}
              </button>

              <p className="text-center text-gray-600">
                Don't have you account?{' '}
                <button
                  type="button"
                  onClick={() => setShowSignUpModal(true)}
                  className="text-blue-500 font-semibold hover:underline"
                >
                  Sign Up
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>

      {showSignUpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="relative bg-white rounded-3xl shadow-2xl p-12 max-w-2xl w-full">
            <div className="absolute -top-4 -left-4 w-48 h-48 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full opacity-20 blur-3xl"></div>
            <div className="absolute -bottom-4 -right-4 w-48 h-48 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full opacity-20 blur-3xl"></div>

            <div className="relative">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-lg opacity-50"></div>
                  <div className="relative bg-gradient-to-br from-blue-500 to-cyan-400 p-6 rounded-full">
                    <User size={40} className="text-white" strokeWidth={2.5} />
                  </div>
                </div>
              </div>

              <h2 className="text-3xl font-bold text-gray-900 text-center mb-2">Create Account</h2>
              <p className="text-center text-gray-600 mb-8">Join FlowStock today!</p>

              <form onSubmit={handleSignUp} className="space-y-5">
                {signUpError && (
                  <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{signUpError}</p>
                  </div>
                )}

                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={signUpData.name}
                    onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-purple-400 transition-colors text-gray-700 placeholder-gray-400"
                    required
                    disabled={isSignUpLoading}
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={signUpData.email}
                    onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-purple-400 transition-colors text-gray-700 placeholder-gray-400"
                    required
                    disabled={isSignUpLoading}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    placeholder="Password (min 6 characters)"
                    value={signUpData.password}
                    onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-purple-400 transition-colors text-gray-700 placeholder-gray-400"
                    required
                    minLength={6}
                    disabled={isSignUpLoading}
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={signUpData.confirmPassword}
                    onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl focus:outline-none focus:border-purple-400 transition-colors text-gray-700 placeholder-gray-400"
                    required
                    minLength={6}
                    disabled={isSignUpLoading}
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSignUpModal(false)}
                    className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-2xl font-semibold text-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSignUpLoading}
                    className="flex-1 py-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSignUpLoading ? 'Creating Account...' : 'Sign Up'}
                  </button>
                </div>
              </form>

              <p className="text-center text-gray-600 mt-6">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setShowSignUpModal(false)}
                  className="text-blue-500 font-semibold hover:underline"
                >
                  Log In
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
