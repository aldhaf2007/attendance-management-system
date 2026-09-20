import React, { useState } from 'react';
import { 
  LogIn, ShieldAlert, GraduationCap, Monitor, ArrowRight, ShieldCheck, 
  Eye, EyeOff, Sparkles 
} from 'lucide-react';
import { authApi } from '../api';

export default function UnifiedLogin({ onLoginSuccess, onLaunchTerminal }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authApi.login(username, password);
      const data = res.data;
      localStorage.setItem('active_jwt_token', data.access_token);
      localStorage.setItem('kiosk_jwt_token', data.access_token);
      onLoginSuccess(data);
    } catch (err) {
      console.error('Login error:', err);
      let detail = 'Invalid username or password.';
      if (err.response?.data?.detail) {
        detail = err.response.data.detail;
      } else if (err.code === 'ERR_NETWORK' || !err.response) {
        detail = 'Unable to reach backend server. Please check that the server is running on http://localhost:8000.';
      }
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-start py-10 px-4 sm:px-6 font-sans selection:bg-blue-900 selection:text-white">
      <div className="w-full max-w-5xl space-y-10 sm:space-y-12">
        
        {/* Top University Branding Header */}
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-900/10 text-blue-900 border border-blue-900/20 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-blue-700" />
            <span>Academic Management System v1.0</span>
          </div>

          <div className="flex justify-center">
            <div className="p-2 rounded-3xl bg-white text-slate-900 shadow-xl shadow-blue-950/15 ring-4 ring-blue-100 border border-slate-200">
              <img 
                src="/logo.png" 
                alt="ARIGNAR ANNA COLLEGE" 
                className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-2xl" 
              />
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight uppercase">
            ARIGNAR ANNA COLLEGE
          </h1>
          <p className="text-xs sm:text-base text-blue-900 font-bold max-w-2xl mx-auto leading-relaxed">
            Attendance Kiosk & Academic Management Portal
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs sm:text-sm font-medium flex items-center gap-3 shadow-xs">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Single Centered Login Card with Attendance Terminal button below Login */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 flex flex-col justify-between space-y-6 relative overflow-hidden transition-all hover:border-blue-300">
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200/80 shadow-xs">
                  <LogIn className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">Dashboard Sign In</h2>
                  <p className="text-xs text-slate-500 font-medium">Access Admin, Department, or Staff Portals</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Account Username / ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. admin, cs_department, prof_smith"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="off"
                    className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:border-blue-800 focus:outline-none transition-all shadow-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="off"
                      className="w-full bg-slate-50/80 border border-slate-300 rounded-xl pl-4 pr-11 py-3 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:border-blue-800 focus:outline-none transition-all shadow-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>


                {/* Main Sign In Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-blue-900/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      Sign In to Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative flex items-center justify-center pt-1 pb-0.5">
                  <div className="border-t border-slate-200 w-full"></div>
                  <span className="bg-white px-3 text-xs text-slate-400 font-bold uppercase tracking-wider">or</span>
                  <div className="border-t border-slate-200 w-full"></div>
                </div>

                {/* Attendance Terminal Button moved below login button */}
                <button
                  type="button"
                  onClick={onLaunchTerminal}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Monitor className="w-4 h-4 text-white" />
                  <span>Attendance Terminal</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </form>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-blue-700" /> Admin / Dept / Staff</span>
              <span className="bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 font-semibold">JWT OAuth2</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 pb-4 text-center text-xs text-slate-500 font-semibold">
          ARIGNAR ANNA COLLEGE • Academic Attendance Management System
        </div>

      </div>
    </div>
  );
}

