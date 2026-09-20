import React, { useState, useRef, useEffect } from 'react';
import { 
  KeyRound, UserCheck, ShieldAlert, ArrowRight, ArrowLeft, 
  Building2, GraduationCap, CheckCircle2, Clock 
} from 'lucide-react';
import { authApi } from '../api';

export default function KioskLogin({ onTerminalConfigured, onBack = null, defaultInitials = '' }) {
  const [step, setStep] = useState(1); // Step 1: PIN, Step 2: Department Selection, Step 3: Year Selection
  
  const [staffInitials, setStaffInitials] = useState(defaultInitials || '');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [verifiedSession, setVerifiedSession] = useState(null);
  const pinInputRef = useRef(null);

  useEffect(() => {
    if (defaultInitials && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [defaultInitials]);

  const detectAutoPeriodSlot = () => {
    const now = new Date();
    // Convert to IST minutes
    const istTotalMinutes = ((now.getUTCHours() + 5) * 60 + (now.getUTCMinutes() + 30)) % (24 * 60);
    if (istTotalMinutes >= 600 && istTotalMinutes < 660) return 1; // 10:00 - 10:30
    if (istTotalMinutes >= 660 && istTotalMinutes < 720) return 2; // 11:00 - 11:30
    if (istTotalMinutes >= 720 && istTotalMinutes < 810) return 3; // 12:00 - 12:30
    if (istTotalMinutes >= 810 && istTotalMinutes < 870) return 4; // 13:30 - 14:00
    if (istTotalMinutes >= 870 && istTotalMinutes < 930) return 5; // 14:30 - 15:00
    return 1;
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    if (!staffInitials || staffInitials.trim().length < 2) {
      setError('Please enter your 2 to 5 letter Staff Initials (e.g. JS, SD).');
      return;
    }
    if (!pin || pin.trim().length === 0) {
      setError('Please enter your 4-digit Staff PIN.');
      return;
    }

    setLoading(true);
    setError('');

    const autoHour = detectAutoPeriodSlot();

    try {
      const payload = {
        initials: staffInitials.trim().toUpperCase(),
        pin: pin,
        hour_number: autoHour
      };

      const res = await authApi.directKioskUnlock(payload);

      const data = res.data;
      localStorage.setItem('kiosk_submission_token', data.access_token);

      // Ensure all authorized departments (Primary + all associated Cross-Teaching) are retrieved
      let authorizedDepts = Array.isArray(data.departments) ? [...data.departments] : [];
      if (authorizedDepts.length <= 1 && data.staff_id) {
        try {
          const deptRes = await authApi.getStaffDepartments(data.staff_id);
          if (Array.isArray(deptRes.data) && deptRes.data.length > 0) {
            authorizedDepts = deptRes.data;
          }
        } catch (fetchErr) {
          console.warn('Could not fetch extra departments, using unlock response:', fetchErr);
        }
      }

      if (authorizedDepts.length === 0 && data.department_id) {
        authorizedDepts = [{
          id: data.department_id,
          name: data.department_name || 'Primary Department',
          is_primary: true
        }];
      }

      setVerifiedSession({
        ...data,
        departments: authorizedDepts
      });
      // Route directly to Step 2 (Department Selection Cards)
      setStep(2);
    } catch (err) {
      console.error('Terminal PIN verification error:', err);
      const msg = err.response?.data?.detail || 'Invalid Staff Initials or 4-digit PIN.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDepartment = async (dept) => {
    const autoHour = detectAutoPeriodSlot();
    try {
      setLoading(true);
      const res = await authApi.selectKioskDepartment({
        staff_id: verifiedSession.staff_id,
        department_id: dept.id,
        hour_number: autoHour
      });
      const data = res.data;
      localStorage.setItem('kiosk_submission_token', data.access_token);
      setVerifiedSession(prev => ({
        ...prev,
        access_token: data.access_token,
        department_id: data.department_id,
        department_name: data.department_name,
        departments: (Array.isArray(data.departments) && data.departments.length > 0)
          ? data.departments
          : prev.departments
      }));
      setStep(3); // Move to Step 3: Class Year Selection
    } catch (err) {
      console.error('Error selecting department:', err);
      // Fallback: still update local session department since allowed_department_ids covers it
      setVerifiedSession(prev => ({
        ...prev,
        department_id: dept.id,
        department_name: dept.name
      }));
      setStep(3);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectYear = (selectedYear) => {
    const autoHour = detectAutoPeriodSlot();
    if (onTerminalConfigured && verifiedSession) {
      onTerminalConfigured({
        departmentId: verifiedSession.department_id,
        departmentName: verifiedSession.department_name,
        year: selectedYear,
        unlockedHour: autoHour,
        unlockedStaff: {
          staff_id: verifiedSession.staff_id,
          staff_name: verifiedSession.staff_name,
          staff_initials: verifiedSession.staff_initials,
          staff_username: verifiedSession.staff_username,
          departments: verifiedSession.departments || []
        },
        token: verifiedSession.access_token
      });
    }
  };

  const handleStepBack = () => {
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      setStep(1);
    } else if (onBack) {
      onBack();
    }
  };

  const handlePinKeyClick = (num) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  const handlePinBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPin('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-4 font-sans overflow-y-auto">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative max-h-[94vh] flex flex-col my-auto">
        
        {/* Wizard Header Bar */}
        <div className="bg-blue-900 text-white p-4 sm:p-6 text-center relative border-b border-blue-800 shrink-0">
          {step === 1 ? (
            onBack && (
              <button
                type="button"
                onClick={onBack}
                className="absolute left-3 sm:left-4 top-3 sm:top-4 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white border border-blue-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Home</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={handleStepBack}
              className="absolute left-3 sm:left-4 top-3 sm:top-4 px-2.5 sm:px-3 py-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white border border-blue-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}

          <div className="flex items-center justify-center gap-2 mb-2">
            <img 
              src="/logo.png" 
              alt="ARIGNAR ANNA COLLEGE" 
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-contain bg-white p-0.5 shadow-xs border border-blue-400/40" 
            />
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-blue-100">
              ARIGNAR ANNA COLLEGE
            </span>
          </div>

          <div className="inline-flex p-2 sm:p-2.5 rounded-2xl bg-blue-800 text-emerald-400 border border-blue-700 mb-1.5 shadow-xs">
            {step === 1 && <KeyRound className="w-5 h-5 sm:w-6 sm:h-6" />}
            {step === 2 && <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />}
            {step === 3 && <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" />}
          </div>

          <h2 className="text-lg sm:text-2xl font-black tracking-tight">
            {step === 1 && "Staff Verification & PIN"}
            {step === 2 && ((verifiedSession?.departments?.length || 0) > 1 ? "Select Teaching Department" : "Confirm Department for Attendance")}
            {step === 3 && "Select Academic Class Year"}
          </h2>
          <p className="text-[11px] sm:text-xs text-blue-200 mt-1 font-medium max-w-sm mx-auto">
            {step === 1 && "Enter your Staff Initials (2-5 letters) and 4-digit PIN to unlock attendance"}
            {step === 2 && ((verifiedSession?.departments?.length || 0) > 1
              ? `Choose which department you want to take attendance for today (${verifiedSession.departments.length} related departments available):`
              : `Taking attendance for ${verifiedSession?.staff_name || verifiedSession?.staff_username}`)}
            {step === 3 && `Taking attendance for ${verifiedSession?.department_name}. Pick class year:`}
          </p>

          {/* Progress Indicators */}
          <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4">
            <span className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full transition-all ${step === 1 ? 'bg-emerald-400 ring-2 ring-emerald-300' : 'bg-blue-700'}`}></span>
            <span className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full transition-all ${step === 2 ? 'bg-emerald-400 ring-2 ring-emerald-300' : 'bg-blue-700'}`}></span>
            <span className={`w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full transition-all ${step === 3 ? 'bg-emerald-400 ring-2 ring-emerald-300' : 'bg-blue-700'}`}></span>
          </div>
        </div>

        {/* WIZARD STEP CONTENT */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          
          {/* STEP 1: STAFF INITIALS & PIN ENTRY */}
          {step === 1 && (
            <form onSubmit={handleVerifyPin} className="space-y-4">
              {error && (
                <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Staff Initials <span className="text-rose-500">*</span> <span className="text-slate-400 font-normal lowercase">(2 to 5 letters, e.g. JS, SD, AJ)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={5}
                    placeholder="e.g. JS"
                    value={staffInitials}
                    onChange={(e) => setStaffInitials(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        pinInputRef.current?.focus();
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-4 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-800 font-black text-base uppercase tracking-widest"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <UserCheck className="w-4 h-4 text-blue-800" />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    4-Digit Staff PIN
                  </label>
                  <span className="text-[11px] text-blue-800 font-medium">Type with keyboard or use keypad</span>
                </div>
                <div className="relative">
                  <input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      const numericOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPin(numericOnly);
                    }}
                    placeholder="••••"
                    autoComplete="current-password"
                    className="w-full bg-slate-50 border border-slate-300 text-center tracking-[0.5em] text-2xl font-mono text-blue-900 rounded-xl py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-800 shadow-inner font-bold"
                  />
                </div>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2 py-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinKeyClick(num.toString())}
                    className="touch-target min-h-[44px] bg-slate-100 hover:bg-blue-50 active:bg-blue-100 text-slate-900 font-extrabold rounded-xl text-lg transition-colors border border-slate-200 shadow-xs cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinClear}
                  className="touch-target min-h-[44px] bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs uppercase border border-rose-200 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handlePinKeyClick('0')}
                  className="touch-target min-h-[44px] bg-slate-100 hover:bg-blue-50 active:bg-blue-100 text-slate-900 font-extrabold rounded-xl text-lg border border-slate-200 shadow-xs cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="touch-target min-h-[44px] bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs uppercase border border-amber-200 cursor-pointer"
                >
                  ⌫ Del
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                ) : (
                  <>
                    Verify PIN & Continue
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: MULTI-DEPARTMENT SELECTION */}
          {step === 2 && verifiedSession && (
            <div className="space-y-4 py-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs sm:text-sm font-semibold flex items-center gap-2 justify-center shadow-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  Staff Verified: <strong>{verifiedSession.staff_name || verifiedSession.staff_username}</strong> {verifiedSession.staff_initials ? `(${verifiedSession.staff_initials})` : ''}
                </span>
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Select Department for Attendance
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {(verifiedSession.departments?.length || 0) > 1
                    ? 'You are assigned to multiple departments. Click a department card below to proceed:'
                    : 'Confirm your department to proceed:'}
                </p>
              </div>

              {/* Authorized Department Cards Grid */}
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                <div className={`grid gap-3 ${(verifiedSession.departments?.length || 0) > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  {(verifiedSession.departments && verifiedSession.departments.length > 0
                    ? verifiedSession.departments
                    : [{ id: verifiedSession.department_id, name: verifiedSession.department_name, is_primary: true }]
                  ).map((dept) => {
                    const isCurrentSelected = verifiedSession.department_id === dept.id;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        disabled={loading}
                        onClick={() => handleSelectDepartment(dept)}
                        className={`w-full p-4 rounded-2xl border-2 transition-all shadow-xs flex flex-col justify-between gap-3 text-left cursor-pointer group ${
                          isCurrentSelected
                            ? 'bg-blue-50/90 border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-blue-400 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`p-3 rounded-xl transition-transform group-hover:scale-105 shrink-0 ${
                            isCurrentSelected ? 'bg-blue-900 text-white' : 'bg-slate-100 text-blue-900 group-hover:bg-blue-900 group-hover:text-white'
                          }`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-950">
                                {dept.name}
                              </h4>
                            </div>
                            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                              {dept.is_primary ? (
                                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                  ★ Primary Dept
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                                  ⚡ Cross-Teaching
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono">
                                #{dept.id}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="w-full pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-black text-blue-900">
                          <span>Select Department</span>
                          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-900 group-hover:bg-blue-900 group-hover:text-white transition-colors">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {(verifiedSession.departments?.length || 0) > 1 && (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-[11px] font-bold flex items-center justify-center gap-2">
                  <span>⚡ <strong>Quick Switch:</strong> You can also switch between your departments directly inside the attendance grid without re-entering PIN!</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: CLASS YEAR SELECTION */}
          {step === 3 && (
            <div className="space-y-4 text-center py-1 animate-in fade-in zoom-in-95 duration-150">
              {/* Selected Department Banner with Change Dept option */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-blue-900 text-white rounded-xl shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block tracking-wider">
                      Selected Department
                    </span>
                    <h4 className="text-sm font-black text-slate-900 truncate">
                      {verifiedSession?.department_name}
                    </h4>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 shadow-2xs"
                >
                  Change Dept
                </button>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Select Target Class Year
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Taking attendance for {verifiedSession?.department_name}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { year: 1, label: '1st Year', badge: 'Junior' },
                  { year: 2, label: '2nd Year', badge: 'Mid' },
                  { year: 3, label: '3rd Year', badge: 'Senior' },
                ].map((item) => (
                  <button
                    key={item.year}
                    type="button"
                    onClick={() => handleSelectYear(item.year)}
                    className="p-4 bg-slate-50 hover:bg-blue-900 text-slate-900 hover:text-white border-2 border-slate-200 hover:border-blue-800 rounded-2xl transition-all shadow-sm hover:shadow-lg group cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <GraduationCap className="w-7 h-7 text-blue-800 group-hover:text-white transition-colors" />
                    <span className="text-base font-black">{item.label}</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 group-hover:bg-blue-800 text-slate-700 group-hover:text-blue-100">
                      {item.badge}
                    </span>
                  </button>
                ))}
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs font-bold flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Period slot automatically detected by system time!</span>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

