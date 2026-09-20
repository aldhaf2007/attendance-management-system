import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2,
  AlertCircle, Clock, CalendarDays, Plus, Trash2, X, Sparkles,
  Info, ShieldCheck, Sun, Moon, Coffee
} from 'lucide-react';
import { adminApi } from '../api';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarManagement() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [selectedDayType, setSelectedDayType] = useState('full_day');
  const [selectedDescription, setSelectedDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch overrides for current month/year
  const fetchOverrides = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getCalendarOverrides({
        year: currentYear,
        month: currentMonth + 1,
      });
      // Map by date string YYYY-MM-DD
      const map = {};
      (res.data || []).forEach((ov) => {
        map[ov.date] = ov;
      });
      setOverrides(map);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load calendar overrides.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverrides();
  }, [currentYear, currentMonth]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Build days for month
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Helper to format date string YYYY-MM-DD
  const formatDateStr = (year, monthIndex, day) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Helper to resolve status of a date
  const getDateStatus = (year, monthIndex, day) => {
    const dateStr = formatDateStr(year, monthIndex, day);
    const dateObj = new Date(year, monthIndex, day);
    const dayOfWeek = dateObj.getDay(); // 0 is Sunday, 6 is Saturday

    const override = overrides[dateStr];
    if (override) {
      return {
        isOverride: true,
        dayType: override.day_type,
        activePeriods: override.active_periods || [],
        description: override.description,
      };
    }

    // Default schedule: Mon-Fri full_day, Sat-Sun holiday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      return {
        isOverride: false,
        dayType: 'full_day',
        activePeriods: [1, 2, 3, 4, 5],
        description: null,
      };
    } else {
      return {
        isOverride: false,
        dayType: 'holiday',
        activePeriods: [],
        description: 'Weekend',
      };
    }
  };

  // Open modal for a date
  const handleCellClick = (day) => {
    const dateStr = formatDateStr(currentYear, currentMonth, day);
    const currentStatus = getDateStatus(currentYear, currentMonth, day);

    setSelectedDateStr(dateStr);
    setSelectedDayType(currentStatus.dayType);
    setSelectedDescription(currentStatus.description || '');
    setModalOpen(true);
    setSuccessMsg(null);
  };

  // Submit override
  const handleSaveOverride = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      let activePeriods = [1, 2, 3, 4, 5];
      if (selectedDayType === 'half_day') {
        activePeriods = [1, 2, 3];
      } else if (selectedDayType === 'holiday') {
        activePeriods = [];
      }

      await adminApi.setCalendarOverride({
        date: selectedDateStr,
        day_type: selectedDayType,
        active_periods: activePeriods,
        description: selectedDescription.trim() || null,
      });

      setSuccessMsg(`Schedule updated for ${selectedDateStr}`);
      setModalOpen(false);
      await fetchOverrides();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save calendar override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Revert to default schedule (delete override)
  const handleRevertOverride = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await adminApi.deleteCalendarOverride(selectedDateStr);
      setSuccessMsg(`Reverted ${selectedDateStr} to default schedule.`);
      setModalOpen(false);
      await fetchOverrides();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to clear override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Compute month statistics
  let fullDaysCount = 0;
  let halfDaysCount = 0;
  let holidaysCount = 0;
  let overrideCount = Object.keys(overrides).length;

  for (let d = 1; d <= daysInMonth; d++) {
    const status = getDateStatus(currentYear, currentMonth, d);
    if (status.dayType === 'full_day') fullDaysCount++;
    else if (status.dayType === 'half_day') halfDaysCount++;
    else if (status.dayType === 'holiday') holidaysCount++;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3.5">
          <img 
            src="/logo.png" 
            alt="ARIGNAR ANNA COLLEGE" 
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-contain border border-slate-200 bg-white shadow-xs shrink-0" 
          />
          <div>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-900 leading-none mb-1">
              ARIGNAR ANNA COLLEGE
            </p>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Academic Calendar & Holiday Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Configure working days, half-day sessions (Periods 1–3), and official holidays across the academic year.
            </p>
          </div>
        </div>

        {/* Action / Today Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToday}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CalendarDays className="w-4 h-4 text-blue-700" />
            Today
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-2xl text-rose-900 text-xs font-bold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Monthly Summary Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Full Working Days</span>
            <Sun className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 font-mono">{fullDaysCount}</span>
            <span className="text-xs text-slate-400 font-medium">days (P1–P5)</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Half-Days</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-900 font-mono">{halfDaysCount}</span>
            <span className="text-xs text-amber-600 font-medium">days (P1–P3)</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Holidays</span>
            <Coffee className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-rose-900 font-mono">{holidaysCount}</span>
            <span className="text-xs text-rose-500 font-medium">days closed</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Active Overrides</span>
            <Sparkles className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-blue-900 font-mono">{overrideCount}</span>
            <span className="text-xs text-blue-600 font-medium">custom rules</span>
          </div>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        
        {/* Month Navigation Toolbar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1 border border-slate-300">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition-all cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-base sm:text-lg font-black text-slate-900">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
          </div>

          {/* Quick Year & Month Selectors */}
          <div className="flex items-center gap-2">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>

            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100 text-center text-[11px] font-black uppercase text-slate-600 tracking-wider">
          {DAY_NAMES.map((day, idx) => (
            <div
              key={day}
              className={`py-3 ${idx === 0 || idx === 6 ? 'text-rose-700 bg-rose-50/50' : ''}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Day Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-slate-100">
          
          {/* Empty cells before 1st day of month */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="bg-slate-50/70 min-h-[95px] sm:min-h-[110px] p-2" />
          ))}

          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = formatDateStr(currentYear, currentMonth, dayNum);
            const status = getDateStatus(currentYear, currentMonth, dayNum);
            const isToday =
              today.getFullYear() === currentYear &&
              today.getMonth() === currentMonth &&
              today.getDate() === dayNum;

            const isFullDay = status.dayType === 'full_day';
            const isHalfDay = status.dayType === 'half_day';
            const isHoliday = status.dayType === 'holiday';

            return (
              <div
                key={dayNum}
                onClick={() => handleCellClick(dayNum)}
                className={`min-h-[95px] sm:min-h-[110px] p-2 sm:p-2.5 transition-all cursor-pointer relative flex flex-col justify-between group ${
                  isToday
                    ? 'bg-blue-50/40 ring-2 ring-blue-500 ring-inset z-10'
                    : 'bg-white hover:bg-slate-50'
                }`}
              >
                {/* Day Number Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono font-black text-xs sm:text-sm rounded-lg px-1.5 py-0.5 ${
                      isToday
                        ? 'bg-blue-900 text-white shadow-xs'
                        : isHoliday
                        ? 'text-rose-800'
                        : 'text-slate-800'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {status.isOverride && (
                    <span
                      title="Custom Administrator Override"
                      className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-blue-200"
                    />
                  )}
                </div>

                {/* Status Indicator Badges */}
                <div className="my-1.5 space-y-1">
                  {isFullDay && (
                    <span className="block text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 truncate">
                      Full Day (P1-5)
                    </span>
                  )}

                  {isHalfDay && (
                    <span className="block text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 truncate">
                      Half Day (P1-3)
                    </span>
                  )}

                  {isHoliday && (
                    <span className="block text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 border border-rose-300 truncate">
                      Holiday
                    </span>
                  )}

                  {/* Description Note if set */}
                  {status.description && (
                    <p className="text-[10px] text-slate-500 font-medium truncate leading-tight mt-0.5" title={status.description}>
                      {status.description}
                    </p>
                  )}
                </div>

                {/* Subtle Hover Call to Action */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-blue-700 text-right">
                  Click to edit →
                </div>
              </div>
            );
          })}

          {/* Trailing empty cells to fill the last row */}
          {Array.from({ length: (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7 }).map((_, idx) => (
            <div key={`trailing-${idx}`} className="bg-slate-50/70 min-h-[95px] sm:min-h-[110px] p-2" />
          ))}

        </div>

      </div>

      {/* Legend & Instructions Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-blue-700" />
            Legend:
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">Full Day: Periods 1–5 active</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-slate-600 font-medium">Half Day: Periods 1–3 active</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-slate-600 font-medium">Holiday: All attendance locked</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-200" />
            <span className="text-slate-600 font-medium">Admin Override</span>
          </span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          Click any date cell to configure or override schedule.
        </p>
      </div>

      {/* Override Schedule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] uppercase font-mono font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {selectedDateStr}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Configure Academic Schedule
                </h3>
                <p className="text-xs text-slate-500">
                  Override standard working hours or designate holidays for this date.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              
              {/* Day Type Selection Options */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Schedule Type
                </label>

                {/* Option 1: Full Day */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedDayType === 'full_day'
                      ? 'bg-emerald-50/60 border-emerald-400 ring-2 ring-emerald-300/60'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="day_type"
                    value="full_day"
                    checked={selectedDayType === 'full_day'}
                    onChange={(e) => setSelectedDayType(e.target.value)}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-emerald-600" />
                      Full Working Day (Periods 1–5 Active)
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Standard academic day. Terminal opens for Periods 1, 2, 3, 4, and 5 according to the IST time lock.
                    </span>
                  </div>
                </label>

                {/* Option 2: Half Day */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedDayType === 'half_day'
                      ? 'bg-amber-50/60 border-amber-400 ring-2 ring-amber-300/60'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="day_type"
                    value="half_day"
                    checked={selectedDayType === 'half_day'}
                    onChange={(e) => setSelectedDayType(e.target.value)}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Half Day (Periods 1–3 Active Only)
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Periods 1, 2, and 3 are open. Periods 4 and 5 are completely disabled and locked on the terminal.
                    </span>
                  </div>
                </label>

                {/* Option 3: Holiday */}
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    selectedDayType === 'holiday'
                      ? 'bg-rose-50/60 border-rose-400 ring-2 ring-rose-300/60'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="day_type"
                    value="holiday"
                    checked={selectedDayType === 'holiday'}
                    onChange={(e) => setSelectedDayType(e.target.value)}
                    className="mt-1 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 text-rose-600" />
                      Academic Holiday / Campus Closure
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      Campus is closed. All attendance taking is completely prohibited with HTTP 403 Forbidden.
                    </span>
                  </div>
                </label>

              </div>

              {/* Optional Description / Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Event / Reason (Optional)
                </label>
                <input
                  type="text"
                  value={selectedDescription}
                  onChange={(e) => setSelectedDescription(e.target.value)}
                  placeholder="e.g. Local Festival, College Sports Meet, Emergency Weather Closure"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  maxLength={100}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                {overrides[selectedDateStr] ? (
                  <button
                    type="button"
                    onClick={handleRevertOverride}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Revert to Default
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">Currently using default schedule</span>
                )}

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-1/2 sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-1/2 sm:w-auto px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSubmitting ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
