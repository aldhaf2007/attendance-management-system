import React, { useState } from 'react';
import { 
  LogIn, ShieldAlert, GraduationCap, Monitor, ArrowRight, ShieldCheck, 
  Eye, EyeOff, Sparkles, Building2, UserCheck, KeyRound, CheckCircle2, Lock, User,
  Clock, Zap
} from 'lucide-react';
import { authApi } from '../api';

export default function UnifiedLogin({ onLoginSuccess, onLaunchTerminal }) {
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'login'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const quickRoles = [
    { label: 'Admin', user: 'admin', pass: 'admin123', icon: ShieldCheck, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { label: 'Staff Demo', user: 'prof_smith', pass: 'staff123', icon: UserCheck, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { label: 'Dept Demo', user: 'cs_dept', pass: 'dept123', icon: Building2, color: 'text-purple-700 bg-purple-50 border-purple-200' }
  ];

  const handleQuickRole = (role) => {
    setActiveTab('login');
    setUsername(role.user);
    setPassword(role.pass);
    setError('');
  };

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
        detail = 'Unable to reach backend server. Please check that the server is running on http://localhost:8001.';
      }
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div className="min-h-screen bg-slate-50/70 bg-grid-subtle text-slate-900 flex flex-col items-center justify-center py-6 sm:py-10 px-3 sm:px-6 font-sans relative overflow-hidden selection:bg-blue-900 selection:text-white">
      {/* Ambient background glow orbs */}
      <div className="absolute -top-36 -left-36 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-36 -right-36 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="w-full max-w-lg space-y-5 sm:space-y-6 relative z-10">
        
        {/* Top University Branding Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/95 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-600 font-semibold">{todayFormatted}</span>
            <span className="text-slate-300">•</span>
            <span className="text-blue-900 font-extrabold uppercase tracking-wider text-[10px] sm:text-[11px]">Academic Portal</span>
          </div>

          <div className="flex justify-center">
            <div className="p-2 rounded-2xl bg-white shadow-xl shadow-blue-950/10 ring-4 ring-blue-50 border border-blue-100 transition-transform duration-200 hover:scale-105">
              <img 
                src="/logo.png" 
                alt="ARIGNAR ANNA COLLEGE" 
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl" 
              />
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase leading-tight">
              ARIGNAR ANNA COLLEGE
            </h1>
            <p className="text-xs sm:text-sm text-blue-900 font-extrabold tracking-wide uppercase mt-0.5">
              Academic Attendance & Management System
            </p>
          </div>
        </div>

        {/* PRIMARY GATEWAY TABS (Terminal vs Dashboard) */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-200/80 rounded-2xl border border-slate-300 shadow-2xs gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('terminal')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'terminal'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/25 scale-[1.02]'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Attendance Terminal</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-blue-900 text-white shadow-md shadow-blue-900/25 scale-[1.02]'
                : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Portal Sign In</span>
          </button>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm font-medium flex items-center gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* TAB 1: HERO ATTENDANCE TERMINAL (FAST ACCESS) */}
        {activeTab === 'terminal' && (
          <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white rounded-3xl p-6 sm:p-7 shadow-xl shadow-emerald-950/20 border border-emerald-500/40 space-y-5 relative overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Background pattern */}
            <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none">
              <Monitor className="w-48 h-48" />
            </div>

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-emerald-100 text-xs font-bold border border-white/20 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
                <span>Active Classroom Kiosk</span>
              </span>
              <span className="text-[11px] font-mono font-bold bg-black/20 px-2.5 py-1 rounded-lg border border-white/10">
                1-Tap Fast PIN
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>Classroom Attendance Terminal</span>
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100 mt-1.5 leading-relaxed font-medium">
                Faculty instant unlock with Staff Initials & 4-digit PIN. Mark classroom attendance for Period 1 to 5.
              </p>
            </div>

            {/* Timetable quick badge strip */}
            <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-bold py-1">
              {[
                { p: 'P1', t: '10:00' },
                { p: 'P2', t: '11:00' },
                { p: 'P3', t: '12:00' },
                { p: 'P4', t: '13:30' },
                { p: 'P5', t: '14:30' }
              ].map((slot) => (
                <div key={slot.p} className="bg-white/15 rounded-xl py-1.5 px-1 border border-white/15 backdrop-blur-xs">
                  <span className="block text-emerald-200 text-[9px] uppercase font-mono">{slot.p}</span>
                  <span className="text-white font-mono text-[11px] font-black">{slot.t}</span>
                </div>
              ))}
            </div>

            {/* MASSIVE ACCESSIBLE LAUNCH BUTTON */}
            <button
              type="button"
              onClick={onLaunchTerminal}
              className="w-full py-4 px-6 bg-white hover:bg-emerald-50 active:scale-[0.98] text-emerald-950 font-black text-base sm:text-lg rounded-2xl shadow-xl shadow-black/20 transition-all flex items-center justify-center gap-3 cursor-pointer group"
            >
              <Monitor className="w-5 h-5 text-emerald-700 group-hover:scale-110 transition-transform" />
              <span>Launch Attendance Terminal</span>
              <ArrowRight className="w-5 h-5 text-emerald-700 group-hover:translate-x-1.5 transition-transform" />
            </button>

            <div className="pt-2 border-t border-emerald-500/40 flex items-center justify-between text-[11px] text-emerald-200 font-medium">
              <span>Touch-optimized for smartphones & tablets</span>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="underline hover:text-white cursor-pointer font-bold"
              >
                Need Admin/HOD login?
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MANAGEMENT PORTAL LOGIN (ADMIN / DEPT / STAFF) */}
        {activeTab === 'login' && (
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/70 space-y-5 transition-all animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-900 border border-blue-200/80 shadow-2xs">
                  <LogIn className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">Dashboard Sign In</h2>
                  <p className="text-xs text-slate-500 font-medium">Administrator, Department HOD, or Staff</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[10px] uppercase font-black bg-blue-50 text-blue-900 border border-blue-200">
                JWT Auth
              </span>
            </div>

            {/* Quick Demo Credentials Autofill Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Quick Demo Presets:</span>
              <div className="grid grid-cols-3 gap-2">
                {quickRoles.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => handleQuickRole(r)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 hover:shadow-xs active:scale-95 ${r.color}`}
                      title={`Fill ${r.label} credentials (${r.user})`}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Username / ID
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. admin, cs_department, prof_smith"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className="w-full bg-slate-50/90 border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:border-blue-800 focus:outline-none transition-all shadow-2xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full bg-slate-50/90 border border-slate-300 rounded-xl pl-10 pr-11 py-2.5 text-slate-900 text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-800 focus:border-blue-800 focus:outline-none transition-all shadow-2xs"
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
                className="w-full py-3 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-800 hover:to-blue-700 active:scale-[0.99] text-white font-extrabold text-sm rounded-xl shadow-md shadow-blue-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-blue-700" /> RBAC Level 1-3</span>
              <button
                type="button"
                onClick={() => setActiveTab('terminal')}
                className="text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Monitor className="w-3 h-3" />
                <span>Attendance Terminal</span>
              </button>
            </div>
          </div>
        )}

        {/* ALWAYS-ACCESSIBLE QUICK LAUNCH BOTTOM PILL (If on login tab) */}
        {activeTab === 'login' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
                <Monitor className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-emerald-950">
                Need to mark classroom attendance?
              </span>
            </div>
            <button
              type="button"
              onClick={onLaunchTerminal}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1"
            >
              <span>Launch Terminal</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 font-medium space-y-0.5">
          <p>ARIGNAR ANNA COLLEGE • Official Academic Portal</p>
          <p className="text-[11px] text-slate-400">All rights reserved &copy; {new Date().getFullYear()}</p>
        </div>

      </div>
    </div>
  );
}

