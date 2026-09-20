import React from 'react';
import { GraduationCap, Clock, UserCheck, Lock, ShieldCheck, Building2 } from 'lucide-react';

export default function Header({
  terminalName = "CS - 2nd Year Terminal",
  unlockedStaff = null,
  activePeriod = 1,
  periodSlots = {},
  onLockTerminal = () => {}
}) {
  const currentSlot = periodSlots[activePeriod] || ["--:--", "--:--"];
  const deptsCount = unlockedStaff?.departments?.length || 0;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 sticky top-0 z-30 shadow-xs px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        
        {/* Academic Terminal Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img 
              src="/logo.png" 
              alt="ARIGNAR ANNA COLLEGE" 
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl object-contain border border-blue-200 shadow-2xs bg-white shrink-0" 
            />
            <div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-900 leading-none mb-1">
                ARIGNAR ANNA COLLEGE
              </p>
              <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
                <span className="truncate max-w-[180px] sm:max-w-none">{terminalName}</span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" />
                  Kiosk Active
                </span>
                {deptsCount > 1 && (
                  <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-purple-100 text-purple-900 border border-purple-200">
                    <Building2 className="w-3 h-3 mr-1 text-purple-700" />
                    Multi-Dept
                  </span>
                )}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Academic Attendance Terminal</p>
            </div>
          </div>

          {/* Mobile-only Kiosk Badge */}
          <span className="sm:hidden inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 mr-0.5 text-emerald-600" />
            Active
          </span>
        </div>

        {/* Status Bar & Unlocked Info */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Active Period Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100/90 px-3 py-1.5 rounded-xl border border-slate-200 text-xs sm:text-sm shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-slate-500 font-bold text-[10px] sm:text-xs uppercase">Period {activePeriod}:</span>
            <span className="text-blue-900 font-black font-mono text-xs">{currentSlot[0]}–{currentSlot[1]}</span>
          </div>

          {/* Unlocked Staff Member */}
          {unlockedStaff ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs">
              <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center font-black text-[9px] font-mono">
                {unlockedStaff.staff_initials || unlockedStaff.staff_username.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-xs">
                <span className="text-slate-400 block text-[9px] uppercase font-bold leading-none">Faculty</span>
                <span className="text-emerald-950 font-black text-[11px] sm:text-xs">{unlockedStaff.staff_username}</span>
              </div>
              <button
                onClick={onLockTerminal}
                className="ml-1 p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 transition-colors cursor-pointer"
                title="Lock Period Slot"
              >
                <Lock className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl text-xs text-rose-700 font-semibold shadow-2xs">
              <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>PIN Required</span>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
