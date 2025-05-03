// app/auth/login/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../../lib/auth';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
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
      setErrorMsg('Please enter credentials');
      return;
    }

    try {
      await login(username, password);
    } catch (error) {
      console.error('Login submission error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative">
      {/* Background Video */}
      <div className="absolute inset-0 z-0 bg-black">
        <div className={`transition-opacity duration-1000 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}>
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            className="absolute w-full h-full object-cover"
            onLoadedData={() => setVideoLoaded(true)}
          >
            <source src="/videos/drone-river.mp4" type="video/mp4" />
            <source src="/videos/drone-river.webm" type="video/webm" />
          </video>
        </div>

        {/* Reduced gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/20 to-transparent z-10"></div>
      </div>
      
      {/* Content */}
      <div className="z-20 flex flex-col items-center justify-center p-4 w-full max-w-md relative">
        <div className="text-center mb-8">
          <h1 className="text-8xl font-thin tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600 mb-2 text-shadow-lg">
            FLYOS
          </h1>
          <div className="h-[1px] w-48 mx-auto bg-gradient-to-r from-transparent via-blue-500/80 to-transparent my-3"></div>
          <p className="text-md text-gray-300 tracking-[0.4em] font-light">
            DRONE CONTROL SYSTEM
          </p>
        </div>
        
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="px-10 py-3 rounded-full bg-gradient-to-r from-blue-500/40 to-indigo-500/40 hover:from-blue-500/60 hover:to-indigo-500/60 backdrop-blur-sm border border-blue-400/30 transition-all group"
          >
            <span className="text-lg text-blue-100 tracking-wider font-light">ENTER</span>
          </button>
        ) : (
          <div className="max-w-md w-full bg-gradient-to-b from-gray-900/80 to-black/80 p-10 rounded-xl shadow-2xl border border-blue-500/20 backdrop-blur-md animate-fadeIn">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/60 border border-blue-500/30 rounded-lg focus:outline-none focus:border-blue-400 text-white placeholder-gray-500 transition-colors"
                />
                
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900/60 border border-blue-500/30 rounded-lg focus:outline-none focus:border-blue-400 text-white placeholder-gray-500 transition-colors"
                />
              </div>

              {errorMsg && (
                <div className="bg-gradient-to-r from-red-900/40 to-rose-900/40 border-l-4 border-rose-500 text-rose-300 p-3 rounded text-sm">
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600/80 to-indigo-600/80 hover:from-blue-600 hover:to-indigo-600 text-white py-3 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center gap-2 font-light tracking-wider"
              >
                <span>{loading ? 'CONNECTING' : 'ACCESS'}</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Add keyframes for animations and text shadow */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .text-shadow-lg {
          text-shadow: 0 0 30px rgba(59, 130, 246, 0.8), 0 0 60px rgba(79, 70, 229, 0.6);
        }
      `}</style>
    </div>
  );
}
