import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginSignupPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const BASE_URL = "http://localhost:3000";
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = isLogin ? `${BASE_URL}/login` : `${BASE_URL}/signup`;
      
      // Prepare data based on login/signup mode
      const requestData = isLogin 
        ? { username: formData.username, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token in localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        setSuccess(data.message);
        console.log('Success:', data);
        // Redirect to chat page using navigate
        navigate('/chat');
        
      } else {
        setError(data.message || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Network error. Please check if the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ username: '', email: '', password: '' });
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full flex">
        {/* Left Panel - Welcome Section */}
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white p-12 flex-1 flex flex-col justify-center items-start relative">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-4">
              {isLogin ? 'Welcome Back!' : 'Join Us Today!'}
            </h1>
            <p className="text-purple-100 mb-8 text-lg">
              {isLogin 
                ? 'Enter your personal details to use all of site features'
                : 'Create your account to access all amazing features'
              }
            </p>
            <button
              onClick={toggleMode}
              className="border-2 border-white text-white px-8 py-3 rounded-full hover:bg-white hover:text-purple-600 transition-all duration-300 font-semibold"
            >
              {isLogin ? 'SIGN UP' : 'SIGN IN'}
            </button>
          </div>
        </div>

        {/* Right Panel - Form Section */}
        <div className="flex-1 p-12 flex flex-col justify-center">
          <div className="w-full max-w-sm mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
              {isLogin ? 'Sign In' : 'Create Account'}
            </h2>

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                {success}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  name="username"
                  placeholder="Username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-900 border-0 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
                  required
                />
              </div>

              {!isLogin && (
                <div>
                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-100 text-gray-900 border-0 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
                    required={!isLogin}
                  />
                </div>
              )}
              
              <div>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-gray-100 text-gray-900 border-0 rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
                  required
                />
              </div>

              {isLogin && (
                <div className="text-right">
                  <a href="#" className="text-sm text-gray-500 hover:text-purple-600 transition-colors">
                    Forgot your password?
                  </a>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    {isLogin ? 'SIGNING IN...' : 'SIGNING UP...'}
                  </div>
                ) : (
                  isLogin ? 'SIGN IN' : 'SIGN UP'
                )}
              </button>
            </div>

            {/* Toggle Link */}
            <p className="text-center text-gray-600 mt-6">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={toggleMode}
                className="text-purple-600 hover:text-purple-800 font-semibold transition-colors"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}