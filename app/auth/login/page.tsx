// app/auth/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { useRouter } from 'next/navigation';
import { Lock, User } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const { login, loading, error, user, clearError } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (user) {
      const role = user.role.toLowerCase().replace('_', '-');
      router.push(`/secure/${role}/dashboard`);
    }
  }, [user, router]);

  useEffect(() => {
    if (error) setErrorMsg(error);
  }, [error]);

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
      console.error('Login submission error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 overflow-hidden">
      {/* Simple animated background with CSS animations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="cloud1 absolute top-10 left-[5%] w-64 h-16 bg-blue-900/10 rounded-full blur-3xl opacity-30"></div>
        <div className="cloud2 absolute top-40 left-[10%] w-96 h-24 bg-indigo-900/10 rounded-full blur-3xl opacity-20"></div>
        <div className="cloud3 absolute top-80 left-[30%] w-80 h-20 bg-blue-900/5 rounded-full blur-3xl opacity-30"></div>
        <div className="cloud4 absolute top-20 right-[10%] w-72 h-24 bg-indigo-900/10 rounded-full blur-3xl opacity-20"></div>
        <div className="cloud5 absolute top-60 right-[20%] w-64 h-20 bg-blue-900/10 rounded-full blur-3xl opacity-40"></div>
      </div>

      <style jsx>{`
        .cloud1 {
          animation: float 30s ease-in-out infinite;
        }
        .cloud2 {
          animation: float 45s ease-in-out infinite;
        }
        .cloud3 {
          animation: float 40s ease-in-out infinite reverse;
        }
        .cloud4 {
          animation: float 35s ease-in-out infinite reverse;
        }
        .cloud5 {
          animation: float 50s ease-in-out infinite;
        }
        @keyframes float {
          0% { transform: translateX(0); opacity: 0.3; }
          50% { transform: translateX(200px); opacity: 0.5; }
          100% { transform: translateX(0); opacity: 0.3; }
        }
      `}</style>

      <div className="z-10 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <h1 className="text-7xl font-thin tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500 mb-2">FLYOS</h1>
          <div className="h-[1px] w-48 mx-auto bg-gradient-to-r from-transparent via-blue-500/60 to-transparent my-3"></div>
          <p className="text-md text-gray-400 tracking-[0.4em] font-light">
            MILITARY-GRADE DRONE CONTROL SYSTEM
          </p>
        </div>
        
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 hover:from-blue-800/80 hover:to-indigo-800/80 border border-blue-500/30 text-white py-3 px-8 rounded-lg shadow-lg transition-all flex items-center gap-2"
          >
            <Lock className="h-5 w-5" />
            <span className="text-lg tracking-wider font-light">ACCESS SYSTEM</span>
          </button>
        ) : (
          <div className="max-w-md w-full bg-gradient-to-b from-gray-900/80 to-black/80 p-10 rounded-xl shadow-2xl border border-gray-800">
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-light text-blue-300 tracking-wider mb-2 flex items-center justify-center gap-2">
                <Lock className="h-5 w-5" />
                SECURE ACCESS
              </h2>
              <p className="text-sm text-gray-400">
                Enter your credentials to access the system
              </p>
            </div>
            
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 transition-colors"
                  />
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-500 transition-colors"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-gradient-to-r from-red-900/30 to-rose-900/30 border-l-4 border-rose-500 text-rose-300 p-3 rounded text-sm">
                  {errorMsg}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center gap-2 font-light tracking-wider"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>AUTHENTICATING...</span>
                    </>
                  ) : (
                    <span>SIGN IN</span>
                  )}
                </button>
              </div>
              
              <div className="mt-8 text-center text-sm text-gray-400">
                <p>Available login credentials:</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div className="bg-gray-800/50 p-2 rounded border border-gray-700 hover:border-blue-500/30 transition-colors cursor-pointer"
                       onClick={() => setUsername('main_admin')}>
                    <span className="font-semibold block">Main HQ</span>
                    <span className="opacity-75">main_admin</span>
                    <span className="opacity-75 block">password</span>
                  </div>
                  <div className="bg-gray-800/50 p-2 rounded border border-gray-700 hover:border-blue-500/30 transition-colors cursor-pointer"
                       onClick={() => setUsername('region_east')}>
                    <span className="font-semibold block">Regional HQ</span>
                    <span className="opacity-75">region_east</span>
                    <span className="opacity-75 block">password</span>
                  </div>
                  <div className="bg-gray-800/50 p-2 rounded border border-gray-700 hover:border-blue-500/30 transition-colors cursor-pointer"
                       onClick={() => setUsername('operator1')}>
                    <span className="font-semibold block">Operator</span>
                    <span className="opacity-75">operator1</span>
                    <span className="opacity-75 block">password</span>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
