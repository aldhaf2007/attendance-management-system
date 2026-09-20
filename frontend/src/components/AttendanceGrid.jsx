import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, XCircle, Clock, Lock, Send, CheckCheck, UserX, 
  AlertTriangle, RefreshCw, ArrowLeft, Calendar, CalendarX, 
  Building2, GraduationCap, ArrowRight, Layers, Sparkles,
  Smartphone, Monitor, Search, Filter, SlidersHorizontal, Check, X
} from 'lucide-react';
import { studentApi, attendanceApi } from '../api';
import StatusBadge from './StatusBadge';

export default function AttendanceGrid({
  departmentId = 1,
  departmentName = "Department",
  year = 2,
  unlockedHour = 1,
  unlockedStaff = null,
  periodSlots = {},
  onBackToHome = null,
  onAttendanceSubmitted = () => {},
  onSwitchClass = null
}) {
  const [students, setStudents] = useState([]);
  const [studentStatusMap, setStudentStatusMap] = useState({});
  const [gridHistory, setGridHistory] = useState({});
  const [periodStaff, setPeriodStaff] = useState({});
  const [activePeriods, setActivePeriods] = useState([1, 2, 3, 4, 5]);
  const [dayType, setDayType] = useState('full_day');
  const [dayDescription, setDayDescription] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [bypassTimeLock, setBypassTimeLock] = useState(true);

  // Responsive Dual View: auto-detect mobile screen (<768px defaults to 'cards')
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'grid';
  });

  // Fast classroom search & quick status filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'present' | 'absent' | 'od'

  // Multi-Department quick switch & post-submission state
  const [submittedModalOpen, setSubmittedModalOpen] = useState(false);
  const [autoLockCountdown, setAutoLockCountdown] = useState(20);

  const availableDepartments = unlockedStaff?.departments && unlockedStaff.departments.length > 0
    ? unlockedStaff.departments
    : [{ id: departmentId, name: departmentName, is_primary: true }];

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadClassData();
  }, [departmentId, year, unlockedHour]);

  const loadClassData = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const studentsRes = await studentApi.getClassStudents(departmentId, year);
      const studentList = studentsRes.data;
      setStudents(studentList);

      try {
        const gridRes = await attendanceApi.getGrid(departmentId, year, todayStr);
        const gridData = gridRes.data;

        if (gridData.active_periods) setActivePeriods(gridData.active_periods);
        if (gridData.day_type) setDayType(gridData.day_type);
        if (gridData.day_description) setDayDescription(gridData.day_description);

        const historyMap = {};
        const activeHourMap = {};

        gridData.students.forEach((item) => {
          historyMap[item.roll_no] = item.statuses || {};
          activeHourMap[item.roll_no] = item.statuses[unlockedHour] || 'Present';
        });

        setGridHistory(historyMap);
        setPeriodStaff(gridData.period_staff || {});
        setStudentStatusMap(activeHourMap);
      } catch (err) {
        const initialMap = {};
        studentList.forEach((s) => {
          initialMap[s.roll_no] = 'Present';
        });
        setStudentStatusMap(initialMap);
      }
    } catch (err) {
      console.error('Failed to load class students:', err);
      setError('Could not load student list for this department.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = (rollNo) => {
    setStudentStatusMap((prev) => {
      const current = prev[rollNo] || 'Present';
      let nextStatus = 'Present';
      if (current === 'Present') {
        nextStatus = 'Absent';
      } else if (current === 'Absent') {
        nextStatus = 'OD';
      } else if (current === 'OD') {
        nextStatus = 'Present';
      }
      return { ...prev, [rollNo]: nextStatus };
    });
  };

  const setAllStatus = (targetStatus) => {
    setStudentStatusMap((prev) => {
      const updated = {};
      Object.keys(prev).forEach((rollNo) => {
        updated[rollNo] = targetStatus;
      });
      return updated;
    });
  };

  const handleSetSingleStatus = (rollNo, status) => {
    setStudentStatusMap((prev) => ({
      ...prev,
      [rollNo]: status
    }));
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.roll_no.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    const currentStatus = studentStatusMap[student.roll_no] || 'Present';
    if (statusFilter === 'all') return true;
    if (statusFilter === 'present') return currentStatus === 'Present';
    if (statusFilter === 'absent') return currentStatus === 'Absent';
    if (statusFilter === 'od') return currentStatus === 'OD';
    return true;
  });

  useEffect(() => {
    let timer;
    if (submittedModalOpen) {
      setAutoLockCountdown(20);
      timer = setInterval(() => {
        setAutoLockCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onAttendanceSubmitted();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [submittedModalOpen]);

  const handleSwitchDepartment = (dept) => {
    if (onSwitchClass) {
      onSwitchClass({ departmentId: dept.id, departmentName: dept.name, year });
    }
  };

  const handleSwitchYear = (newYear) => {
    if (onSwitchClass) {
      onSwitchClass({ departmentId, departmentName, year: newYear });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    const records = Object.entries(studentStatusMap).map(([roll_no, status]) => ({
      roll_no,
      status
    }));

    const payload = {
      date: todayStr,
      hour_number: unlockedHour,
      records
    };

    try {
      await attendanceApi.submitAttendance(payload, bypassTimeLock);
      setSuccessMsg(`Period ${unlockedHour} attendance successfully submitted and logged!`);
      await loadClassData();
      setSubmittedModalOpen(true);
    } catch (err) {
      console.error('Submission error:', err);
      const detail = err.response?.data?.detail || 'Failed to submit attendance. Check time-lock active window.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const presentCount = Object.values(studentStatusMap).filter((s) => s === 'Present').length;
  const absentCount = Object.values(studentStatusMap).filter((s) => s === 'Absent').length;
  const odCount = Object.values(studentStatusMap).filter((s) => s === 'OD').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent"></div>
        <p className="text-slate-400 font-medium text-sm">Loading academic roster & period grid...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-36 sm:pb-8">
      
      {/* Active Period Control Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome || onAttendanceSubmitted}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer font-bold text-xs shrink-0"
            title="Go Back to Home Page"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-900 leading-none mb-1">
              ARIGNAR ANNA COLLEGE
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Period {unlockedHour} Attendance Grid</span>
              <span className="text-xs px-2.5 py-0.5 rounded-lg bg-blue-100 text-blue-900 font-extrabold border border-blue-200">
                Active Period Slot
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Tap student buttons: <span className="text-emerald-700 font-extrabold">1st = Present</span>, <span className="text-rose-700 font-extrabold">2nd = Absent</span>, <span className="text-amber-800 font-extrabold">3rd = OD</span>
            </p>
          </div>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <button
            onClick={() => setAllStatus('Present')}
            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
            All Present
          </button>
          <button
            onClick={() => setAllStatus('Absent')}
            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer"
          >
            <UserX className="w-3.5 h-3.5 text-rose-700" />
            All Absent
          </button>
          <button
            onClick={loadClassData}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all cursor-pointer"
            title="Refresh Grid"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Class & Multi-Department Switcher Bar */}
      <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-purple-50 border border-blue-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <Building2 className="w-4 h-4 text-blue-800 shrink-0" />
            <span className="text-xs font-bold text-slate-500 uppercase">Dept:</span>
            <span className="text-xs sm:text-sm font-black text-slate-900">{departmentName}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <GraduationCap className="w-4 h-4 text-purple-800 shrink-0" />
            <span className="text-xs font-bold text-slate-500 uppercase">Class:</span>
            <span className="text-xs sm:text-sm font-black text-slate-900">
              {year === 1 ? '1st Year' : year === 2 ? '2nd Year' : '3rd Year'}
            </span>
          </div>
          {availableDepartments.length > 1 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-100 text-purple-900 font-extrabold text-[11px] border border-purple-200">
              <Layers className="w-3.5 h-3.5" />
              Multi-Dept Staff ({availableDepartments.length} Depts)
            </span>
          )}
        </div>

        {/* Quick Switch Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {availableDepartments.length > 1 && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-extrabold uppercase text-slate-500 hidden sm:inline">
                Switch Dept:
              </span>
              <div className="flex items-center gap-1">
                {availableDepartments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleSwitchDepartment(d)}
                    disabled={d.id === departmentId || submitting}
                    className={`touch-target px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                      d.id === departmentId
                        ? 'bg-blue-900 text-white shadow-xs cursor-default'
                        : 'bg-white hover:bg-blue-100 text-blue-900 border border-slate-200 hover:border-blue-300'
                    }`}
                    title={`Switch to ${d.name}`}
                  >
                    <Building2 className="w-3 h-3" />
                    <span>{d.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto md:ml-1">
            <span className="text-[11px] font-extrabold uppercase text-slate-500 hidden sm:inline">
              Switch Year:
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => handleSwitchYear(y)}
                  disabled={y === year || submitting}
                  className={`touch-target px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    y === year
                      ? 'bg-purple-900 text-white shadow-xs cursor-default'
                      : 'bg-white hover:bg-purple-100 text-purple-900 border border-slate-200 hover:border-purple-300'
                  }`}
                  title={`Switch to ${y === 1 ? '1st' : y === 2 ? '2nd' : '3rd'} Year`}
                >
                  {y === 1 ? '1st' : y === 2 ? '2nd' : '3rd'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-900 border border-blue-200">
            <span className="font-mono text-lg sm:text-xl font-bold">{students.length}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 block font-medium">Enrolled</span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900">Class Roster</span>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            <span className="font-mono text-lg sm:text-xl font-bold">{presentCount}</span>
          </div>
          <div>
            <span className="text-[11px] text-emerald-700 block font-medium">Present</span>
            <span className="text-xs sm:text-sm font-extrabold text-emerald-800">{Math.round((presentCount/students.length)*100 || 0)}%</span>
          </div>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
            <span className="font-mono text-lg sm:text-xl font-bold">{absentCount}</span>
          </div>
          <div>
            <span className="text-[11px] text-rose-700 block font-medium">Absent</span>
            <span className="text-xs sm:text-sm font-extrabold text-rose-800">{absentCount} Count</span>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
            <span className="font-mono text-lg sm:text-xl font-bold">{odCount}</span>
          </div>
          <div>
            <span className="text-[11px] text-amber-700 block font-medium">On Duty (OD)</span>
            <span className="text-xs sm:text-sm font-extrabold text-amber-800">{odCount} Count</span>
          </div>
        </div>
      </div>

      {/* Holiday / Half-Day Alert Banners */}
      {dayType === 'holiday' && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
              <CalendarX className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <h4 className="font-black text-rose-900 text-sm sm:text-base flex items-center gap-2">
                <span>College Holiday — Attendance Submissions Locked</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 font-black">
                  Holiday
                </span>
              </h4>
              <p className="text-xs text-rose-700 font-medium mt-0.5">
                {dayDescription || "Today is scheduled as an academic holiday or weekend. Attendance cannot be submitted."}
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block text-[11px] font-mono font-bold text-rose-700 bg-rose-100/80 px-3 py-1.5 rounded-xl border border-rose-200">
            0 Periods Active
          </span>
        </div>
      )}

      {dayType === 'half_day' && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-950 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
              <Clock className="w-6 h-6 shrink-0" />
            </div>
            <div>
              <h4 className="font-black text-amber-950 text-sm sm:text-base flex items-center gap-2">
                <span>Half-Day Academic Schedule</span>
                <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-black">
                  Half Day
                </span>
              </h4>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                {dayDescription || `Only Periods ${activePeriods.join(', ')} are active today. Inactive periods are disabled.`}
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block text-[11px] font-mono font-bold text-amber-800 bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-200">
            Active: Periods {activePeriods.join(', ')}
          </span>
        </div>
      )}

      {/* Alert Banners */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs sm:text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Period Attendance Tracking Overview (Who Took Attendance For Each Period) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200">
              <Clock className="w-4 h-4" />
            </span>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Period Attendance Tracking (Taken By Staff)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium font-mono">Date: {todayStr}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[1, 2, 3, 4, 5].map((period) => {
            const isUnlocked = period === unlockedHour;
            const isPeriodActive = dayType !== 'holiday' && activePeriods.includes(period);
            const staffInfo = periodStaff[period];
            const slotTimes = periodSlots[period] || ["", ""];
            return (
              <div
                key={period}
                className={`p-3 rounded-xl border transition-all ${
                  !isPeriodActive
                    ? 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60'
                    : staffInfo
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : isUnlocked
                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-400/40 shadow-xs'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black ${!isPeriodActive ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                    Period {period}
                  </span>
                  {!isPeriodActive ? (
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[10px] font-bold">
                      Inactive
                    </span>
                  ) : staffInfo ? (
                    <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-black">
                      Recorded
                    </span>
                  ) : isUnlocked ? (
                    <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-black animate-pulse">
                      Active
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-bold">
                      Pending
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[10px] text-slate-500 font-mono">
                  {slotTimes[0] && slotTimes[1] ? `${slotTimes[0]} - ${slotTimes[1]}` : `Hour ${period}`}
                </div>
                <div className="mt-2 pt-1.5 border-t border-slate-200/80 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-medium">By:</span>
                  {!isPeriodActive ? (
                    <span className="text-[11px] text-slate-400 italic">Off-Schedule</span>
                  ) : staffInfo ? (
                    <span className="text-xs font-black text-emerald-950 truncate" title={`${staffInfo.name} (${staffInfo.initials})`}>
                      <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 rounded font-mono font-black text-[10px] mr-1">{staffInfo.initials}</span>
                      {staffInfo.name}
                    </span>
                  ) : isUnlocked ? (
                    <span className="text-xs font-black text-blue-950 truncate">
                      <span className="px-1.5 py-0.5 bg-blue-200 text-blue-900 rounded font-mono font-black text-[10px] mr-1">{unlockedStaff?.staff_initials || 'ME'}</span>
                      {unlockedStaff?.staff_name || 'Current Staff'}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Not taken</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Classroom Search & Dual Responsive View Controller */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input & Status Filter Chips */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Roll No or Student Name..."
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-900 pl-9 pr-8 py-2 rounded-xl text-xs font-semibold border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Status Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`touch-target min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              All ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('present')}
              className={`touch-target min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                statusFilter === 'present'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Present ({presentCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('absent')}
              className={`touch-target min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                statusFilter === 'absent'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              <XCircle className="w-3 h-3" />
              Absent ({absentCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('od')}
              className={`touch-target min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                statusFilter === 'od'
                  ? 'bg-amber-600 text-slate-950 font-black shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              OD ({odCount})
            </button>
          </div>
        </div>

        {/* View Mode Toggle Pill (Cards vs Full Table Grid) */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            View Layout:
          </span>
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`touch-target min-h-[36px] flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-900 shadow-xs ring-1 ring-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-4 h-4 text-blue-800" />
              <span>Mobile Cards</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`touch-target min-h-[36px] flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-900 shadow-xs ring-1 ring-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="w-4 h-4 text-slate-700" />
              <span>Full Table Matrix</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: SMARTPHONE-FOCUSED ATTENDANCE CARDS */}
      {viewMode === 'cards' && (
        <div className="space-y-3">
          {filteredStudents.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-xs">
              <UserX className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">No students found</h4>
              <p className="text-xs text-slate-500">
                No enrolled students matched your search "{searchQuery}" or status filter "{statusFilter}".
              </p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                className="px-4 py-2 bg-blue-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Clear Search & Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredStudents.map((student) => {
                const currentStatus = studentStatusMap[student.roll_no] || 'Present';

                return (
                  <div
                    key={student.roll_no}
                    className={`rounded-2xl border p-3.5 transition-all shadow-xs ${
                      currentStatus === 'Present'
                        ? 'bg-white border-slate-200 hover:border-emerald-300'
                        : currentStatus === 'Absent'
                        ? 'bg-rose-50/50 border-rose-300 ring-1 ring-rose-200'
                        : 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-200'
                    }`}
                  >
                    {/* Top Row: Roll No, Name & Status Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs">
                            {student.roll_no}
                          </span>
                          <h4 className="text-sm font-black text-slate-900 truncate">
                            {student.name}
                          </h4>
                        </div>
                      </div>

                      {/* Current Status Pill */}
                      <span
                        className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                          currentStatus === 'Present'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : currentStatus === 'Absent'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {currentStatus}
                      </span>
                    </div>

                    {/* Today's Period History Micro-Timeline */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px]">
                      <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        Today:
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {[1, 2, 3, 4, 5].map((period) => {
                          const isUnlocked = period === unlockedHour;
                          const isPeriodActive = dayType !== 'holiday' && activePeriods.includes(period);
                          const hist = gridHistory[student.roll_no]?.[period];

                          if (!isPeriodActive) {
                            return (
                              <span
                                key={period}
                                title={`P${period}: Inactive`}
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-mono line-through opacity-50"
                              >
                                P{period}
                              </span>
                            );
                          }

                          if (isUnlocked) {
                            return (
                              <span
                                key={period}
                                title={`P${period}: Current Active Slot (${currentStatus})`}
                                className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] ring-1 ${
                                  currentStatus === 'Present'
                                    ? 'bg-emerald-600 text-white ring-emerald-400 animate-pulse'
                                    : currentStatus === 'Absent'
                                    ? 'bg-rose-600 text-white ring-rose-400 animate-pulse'
                                    : 'bg-amber-500 text-slate-950 ring-amber-300 animate-pulse'
                                }`}
                              >
                                P{period}*
                              </span>
                            );
                          }

                          if (hist) {
                            const isP = hist.toLowerCase() === 'present';
                            const isA = hist.toLowerCase() === 'absent';
                            const isOD = hist.toLowerCase() === 'od';
                            return (
                              <span
                                key={period}
                                title={`P${period}: ${hist}`}
                                className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] ${
                                  isP
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : isA
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : isOD
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                P{period}:{isP ? 'P' : isA ? 'A' : 'OD'}
                              </span>
                            );
                          }

                          return (
                            <span
                              key={period}
                              title={`P${period}: Not Taken Yet`}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 font-mono"
                            >
                              P{period}:-
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Direct 3-Pill Status Action Buttons (Thumb-friendly touch targets) */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => handleSetSingleStatus(student.roll_no, 'Present')}
                        className={`touch-target py-2.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                          currentStatus === 'Present'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400 scale-[1.02]'
                            : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Present</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetSingleStatus(student.roll_no, 'Absent')}
                        className={`touch-target py-2.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                          currentStatus === 'Absent'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400 scale-[1.02]'
                            : 'bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-200'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Absent</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetSingleStatus(student.roll_no, 'OD')}
                        className={`touch-target py-2.5 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                          currentStatus === 'OD'
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 ring-2 ring-amber-300 scale-[1.02]'
                            : 'bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-900 border border-slate-200'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        <span>OD</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop/Tablet Card View Bottom Submission Bar */}
          <div className="hidden sm:flex bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm items-center justify-between gap-4 mt-4">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={bypassTimeLock}
                onChange={(e) => setBypassTimeLock(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-800"></div>
              <span className="ms-3 text-xs font-extrabold text-slate-700">
                Dev/Test Time Lock Override
              </span>
            </label>

            {(() => {
              const isCurrentHourActive = dayType !== 'holiday' && activePeriods.includes(unlockedHour);
              return (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !isCurrentHourActive}
                  className="px-8 py-3.5 bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                  ) : !isCurrentHourActive ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Period {unlockedHour} Inactive
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Period {unlockedHour} Attendance
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* VIEW 2: FULL TIMETABLE MATRIX (DESKTOP GRID) */}
      {viewMode === 'grid' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
          <div className="table-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="sticky top-0 z-30 shadow-xs">
                <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-4 sticky top-0 left-0 z-40 bg-slate-100 min-w-[120px] shadow-xs border-r border-slate-200">Roll No</th>
                  <th className="py-3.5 px-4 sticky top-0 left-[120px] z-40 bg-slate-100 min-w-[150px] shadow-xs border-r border-slate-200">Student Name</th>
                  {[1, 2, 3, 4, 5].map((period) => {
                    const isUnlocked = period === unlockedHour;
                    const isPeriodActive = dayType !== 'holiday' && activePeriods.includes(period);
                    const slotTimes = periodSlots[period] || ["", ""];
                    const staffInfo = periodStaff[period];
                    return (
                      <th
                        key={period}
                        className={`sticky top-0 z-30 py-3.5 px-3 text-center border-l border-slate-200 ${
                          !isPeriodActive
                            ? 'bg-slate-100 text-slate-400 opacity-60'
                            : isUnlocked
                            ? 'bg-blue-50 text-blue-900 font-black'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`font-black flex items-center gap-1 ${!isPeriodActive ? 'line-through text-slate-400' : ''}`}>
                            {(!isPeriodActive || !isUnlocked) && <Lock className="w-3 h-3 text-slate-400" />}
                            P{period}
                          </span>
                          <span className="text-[10px] opacity-75 font-mono">
                            {slotTimes[0] && slotTimes[1] ? `${slotTimes[0]}-${slotTimes[1]}` : `Hour ${period}`}
                          </span>
                          {!isPeriodActive ? (
                            <span className="mt-1 px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[9px] font-bold">
                              Inactive
                            </span>
                          ) : staffInfo ? (
                            <span
                              title={`Taken by ${staffInfo.name} (${staffInfo.initials})`}
                              className="mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md text-[10px] font-black tracking-wide"
                            >
                              By: {staffInfo.initials}
                            </span>
                          ) : isUnlocked ? (
                            <span
                              title={`Currently active: ${unlockedStaff?.staff_name || 'Staff'}`}
                              className="mt-1 px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-md text-[10px] font-black tracking-wide"
                            >
                              By: {unlockedStaff?.staff_initials || 'Active'}
                            </span>
                          ) : (
                            <span className="mt-1 px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded text-[9px] font-bold">
                              Pending
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm font-medium">
                {filteredStudents.map((student) => {
                  const currentStatus = studentStatusMap[student.roll_no] || 'Present';

                  return (
                    <tr key={student.roll_no} className="hover:bg-slate-50 transition-colors group">
                      {/* STICKY Roll No Column */}
                      <td className="py-3 px-4 font-mono font-extrabold text-blue-900 sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-xs">
                        {student.roll_no}
                      </td>

                      {/* STICKY Student Name Column */}
                      <td className="py-3 px-4 text-slate-900 font-bold sticky left-[120px] z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-xs truncate max-w-[160px]">
                        {student.name}
                      </td>

                      {/* 5 Period Columns */}
                      {[1, 2, 3, 4, 5].map((period) => {
                        const isUnlocked = period === unlockedHour;
                        const isPeriodActive = dayType !== 'holiday' && activePeriods.includes(period);
                        const historicalStatus = gridHistory[student.roll_no]?.[period];

                        if (!isPeriodActive) {
                          return (
                            <td
                              key={period}
                              className="py-2.5 px-2 text-center border-l border-slate-200 bg-slate-100/50 opacity-60 select-none"
                            >
                              <span className="text-xs font-mono text-slate-400 font-bold" title={`Period ${period} is inactive`}>—</span>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={period}
                            className={`py-2.5 px-2 text-center border-l border-slate-200 ${
                              isUnlocked ? 'bg-blue-50/50' : 'bg-slate-50/50'
                            }`}
                          >
                            {isUnlocked ? (
                              <button
                                type="button"
                                onClick={() => handleStatusToggle(student.roll_no)}
                                className={`touch-target w-full py-2.5 px-3 rounded-2xl font-extrabold text-xs transition-all transform active:scale-95 shadow-sm flex items-center justify-center gap-1 cursor-pointer ${
                                  currentStatus === 'Present'
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 shadow-emerald-600/20'
                                    : currentStatus === 'Absent'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-400 shadow-rose-600/20'
                                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-300 shadow-amber-500/20'
                                }`}
                              >
                                {currentStatus === 'Present' && (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Present
                                  </>
                                )}
                                {currentStatus === 'Absent' && (
                                  <>
                                    <XCircle className="w-3.5 h-3.5" />
                                    Absent
                                  </>
                                )}
                                {currentStatus === 'OD' && (
                                  <>
                                    <Clock className="w-3.5 h-3.5" />
                                    OD
                                  </>
                                )}
                              </button>
                            ) : (
                              <div className="flex items-center justify-center opacity-70">
                                <StatusBadge status={historicalStatus} locked={true} />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Desktop Table Bottom Submission Bar */}
          <div className="hidden sm:flex bg-slate-50 p-4 sm:p-6 border-t border-slate-200 items-center justify-between gap-4">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={bypassTimeLock}
                onChange={(e) => setBypassTimeLock(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-800"></div>
              <span className="ms-3 text-xs font-extrabold text-slate-700">
                Dev/Test Time Lock Override
              </span>
            </label>

            {(() => {
              const isCurrentHourActive = dayType !== 'holiday' && activePeriods.includes(unlockedHour);
              return (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !isCurrentHourActive}
                  className="w-full sm:w-auto px-8 py-3.5 bg-blue-900 hover:bg-blue-800 active:scale-[0.99] text-white font-extrabold text-base rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!isCurrentHourActive ? `Period ${unlockedHour} is inactive on this ${dayType === 'holiday' ? 'holiday' : 'schedule'}` : ''}
                >
                  {submitting ? (
                    <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                  ) : !isCurrentHourActive ? (
                    <>
                      <Lock className="w-4 h-4" />
                      Period {unlockedHour} Inactive ({dayType === 'holiday' ? 'Holiday' : 'Off-Slot'})
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Period {unlockedHour} Attendance
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {/* Mobile Floating Sticky Bottom Submission Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-2">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-black">
            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200">
              ✓ {presentCount}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
              ✗ {absentCount}
            </span>
            <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-200">
              ⏱ {odCount}
            </span>
          </div>
          <label className="inline-flex items-center cursor-pointer text-[11px] font-bold text-slate-600">
            <input
              type="checkbox"
              checked={bypassTimeLock}
              onChange={(e) => setBypassTimeLock(e.target.checked)}
              className="sr-only peer"
            />
            <div className="relative w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:start-[1px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-800"></div>
            <span className="ms-1.5 text-[10px] font-extrabold text-slate-500">Dev Override</span>
          </label>
        </div>

        {(() => {
          const isCurrentHourActive = dayType !== 'holiday' && activePeriods.includes(unlockedHour);
          return (
            <button
              onClick={handleSubmit}
              disabled={submitting || !isCurrentHourActive}
              className="w-full py-3.5 bg-blue-900 hover:bg-blue-800 active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-900/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <span className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
              ) : !isCurrentHourActive ? (
                <>
                  <Lock className="w-4 h-4" />
                  Period {unlockedHour} Inactive
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Period {unlockedHour} Attendance ({students.length})
                </>
              )}
            </button>
          );
        })()}
      </div>

      {/* Post-Submission Success & Multi-Department Fast Switch Dialog */}
      {submittedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-center space-y-4 animate-in zoom-in-95 duration-150 relative">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">Attendance Submitted!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Period {unlockedHour} attendance for <strong>{departmentName}</strong> ({year === 1 ? '1st' : year === 2 ? '2nd' : '3rd'} Year) was successfully recorded.
              </p>
            </div>

            {/* Attendance Tally Summary */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-3 gap-2 text-xs">
              <div className="p-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="block font-black text-base">{presentCount}</span>
                <span className="text-[10px] uppercase font-bold text-emerald-700">Present</span>
              </div>
              <div className="p-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                <span className="block font-black text-base">{absentCount}</span>
                <span className="text-[10px] uppercase font-bold text-rose-700">Absent</span>
              </div>
              <div className="p-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                <span className="block font-black text-base">{odCount}</span>
                <span className="text-[10px] uppercase font-bold text-amber-700">OD</span>
              </div>
            </div>

            {/* Next Class Fast Switch Action */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-slate-600 tracking-wider">
                  Take Next Class Attendance:
                </span>
                <span className="text-[10px] font-bold text-blue-700">No PIN re-entry needed</span>
              </div>

              {availableDepartments.length > 1 && (
                <div className="space-y-1.5">
                  {availableDepartments.filter((d) => d.id !== departmentId).map((otherDept) => (
                    <button
                      key={otherDept.id}
                      type="button"
                      onClick={() => {
                        setSubmittedModalOpen(false);
                        handleSwitchDepartment(otherDept);
                      }}
                      className="w-full p-3.5 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-blue-900 border-2 border-blue-200 hover:border-blue-300 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center justify-between cursor-pointer group shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-900 text-white rounded-xl group-hover:scale-105 transition-transform">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="block text-slate-900 group-hover:text-blue-900">{otherDept.name}</span>
                          <span className="text-[10px] text-blue-700 font-bold block">
                            {otherDept.is_primary ? 'Primary Dept' : 'Cross-Teaching'} (ID: #{otherDept.id})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-blue-900 font-extrabold text-xs">
                        <span>Take Attendance</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Other Batches in Current Department */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Other batches in {departmentName}:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3].filter((y) => y !== year).map((otherYear) => (
                    <button
                      key={otherYear}
                      type="button"
                      onClick={() => {
                        setSubmittedModalOpen(false);
                        handleSwitchYear(otherYear);
                      }}
                      className="p-2.5 bg-slate-50 hover:bg-purple-50 text-slate-800 hover:text-purple-900 border border-slate-200 hover:border-purple-300 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <GraduationCap className="w-4 h-4 text-purple-700" />
                      <span>{otherYear === 1 ? '1st' : otherYear === 2 ? '2nd' : '3rd'} Year</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Exit Terminal Action with Auto-lock countdown */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSubmittedModalOpen(false);
                  onAttendanceSubmitted();
                }}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>Finished • Lock Terminal ({autoLockCountdown}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
