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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs px-3 sm:px-6 py-2.5 sm:py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        
        {/* Academic Terminal Title */}
        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img 
              src="/logo.png" 
              alt="ARIGNAR ANNA COLLEGE" 
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-contain border border-blue-200 shadow-xs bg-white shrink-0" 
            />
            <div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-900 leading-none mb-1">
                ARIGNAR ANNA COLLEGE
              </p>
              <h1 className="text-sm sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2">
                <span className="truncate max-w-[180px] sm:max-w-none">{terminalName}</span>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Classroom Kiosk
                </span>
                {deptsCount > 1 && (
                  <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-200">
                    <Building2 className="w-3 h-3 mr-1 text-purple-700" />
                    Multi-Dept
                  </span>
                )}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Academic Attendance Terminal</p>
            </div>
          </div>

          {/* Mobile-only Kiosk Badge */}
          <span className="sm:hidden inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 mr-0.5 text-emerald-600" />
            Kiosk
          </span>
        </div>

        {/* Status Bar & Unlocked Info */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Active Period Badge */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border border-slate-200 text-xs sm:text-sm">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
            <span className="text-slate-600 font-medium text-[11px] sm:text-xs">Period {activePeriod}:</span>
            <span className="text-blue-900 font-extrabold font-mono text-[11px] sm:text-xs">{currentSlot[0]}–{currentSlot[1]}</span>
          </div>

          {/* Unlocked Staff Member */}
          {unlockedStaff ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl">
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <span className="text-slate-500 block text-[9px] sm:text-[10px] uppercase font-bold leading-none">Unlocked</span>
                <span className="text-emerald-900 font-extrabold text-[11px] sm:text-xs">{unlockedStaff.staff_username}</span>
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
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs text-rose-700 font-semibold">
              <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              PIN Required
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
