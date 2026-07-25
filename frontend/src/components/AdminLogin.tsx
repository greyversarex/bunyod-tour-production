import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminLogin: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    if (localStorage.getItem('adminAuthenticated') === 'true') {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'admin',
          password: password
        }),
      });

      const data = await response.json();

      if (data.success && data.data.token) {
        // Store JWT token instead of simple boolean
        localStorage.setItem('adminToken', data.data.token);
        localStorage.setItem('adminAuthenticated', 'true');
        navigate('/admin/dashboard');
      } else {
        setError(data.error || 'Login failed');
        setPassword('');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection error');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#3E3E3E' }}>
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            Enter the admin password to access the dashboard
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm">
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full px-3 py-2 border border-gray-500 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:z-10 sm:text-sm"
                style={{ backgroundColor: '#4A4A4A' }}
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-opacity"
              style={{ backgroundColor: '#3E3E3E' }}
            >
              Sign in
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-400">
              Demo password: <code className="bg-gray-600 text-gray-200 px-1 rounded">123</code>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;