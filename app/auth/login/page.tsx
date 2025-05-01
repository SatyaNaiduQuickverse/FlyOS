'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const { login, loading, error, user, clearError } = useAuth();
  const router = useRouter();
  
  // If already logged in, redirect to appropriate dashboard
  useEffect(() => {
    if (user) {
      const role = user.role.toLowerCase().replace('_', '-');
      router.push(`/secure/${role}/dashboard`);
    }
  }, [user, router]);

  // Update error message when auth error changes
  useEffect(() => {
    if (error) {
      setErrorMsg(error);
    }
  }, [error]);

  // Clear error when form fields change
  useEffect(() => {
    if (errorMsg) {
      setErrorMsg('');
      clearError();
    }
  }, [username, password, clearError, errorMsg]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    
    if (!username || !password) {
      setErrorMsg('Please enter both username and password');
      return;
    }

    try {
      await login(username, password);
    } catch (error) {
      // Error is handled by auth context
      console.error('Login submission error:', error);
    }
  };

  return (
    <ProtectedRoute requireAuth={false}>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-900">
        <div className="max-w-md w-full space-y-8 bg-gray-800 p-10 rounded-xl shadow-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white">
              FlyOS Control System
            </h1>
            <p className="mt-2 text-sm text-gray-400">
              Secure access to military-grade drone operations
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="username" className="sr-only">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-700 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-700 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-900 text-white text-sm p-3 rounded text-center">
                {errorMsg}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                      <svg className="h-5 w-5 text-blue-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                      <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                      </svg>
                    </span>
                    Sign in
                  </>
                )}
              </button>
            </div>
            
            <div className="text-center text-sm text-gray-400">
              <p>Available login credentials:</p>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div className="bg-gray-700 p-2 rounded">
                  <span className="font-semibold block">Main HQ</span>
                  <span className="opacity-75">main_admin</span>
                  <span className="opacity-75 block">password</span>
                </div>
                <div className="bg-gray-700 p-2 rounded">
                  <span className="font-semibold block">Regional HQ</span>
                  <span className="opacity-75">region_east</span>
                  <span className="opacity-75 block">password</span>
                </div>
                <div className="bg-gray-700 p-2 rounded">
                  <span className="font-semibold block">Operator</span>
                  <span className="opacity-75">operator1</span>
                  <span className="opacity-75 block">password</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}
