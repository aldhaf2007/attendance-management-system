import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Users, UserCheck, UserX, AlertTriangle, 
  TrendingUp, ShieldAlert, CheckCircle2, RefreshCw, ArrowLeft, Building2,
  Filter, Calendar, RotateCcw, Search, Clock, ListChecks, CalendarDays,
  LayoutGrid, Table as TableIcon
} from 'lucide-react';
import { analyticsApi, exportApi } from '../api';

export default function DepartmentDashboard({
  departmentId = 1,
  year = 2,
  onYearChange = () => {},
  onBackToTerminal = () => {}
}) {
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  
  // Mobile responsive view mode: 'cards' on mobile (<768px), 'table' on desktop
  const [displayMode, setDisplayMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'cards';
    }
    return 'table';
  });
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'shortage' | 'good'
  
  // Table Filter Controls
  const [tableFilterType, setTableFilterType] = useState('all'); // 'all' | 'monthly' | 'yearly' | 'daily' | 'custom'
  const [tableYear, setTableYear] = useState(new Date().getFullYear());
  const [tableMonth, setTableMonth] = useState(new Date().getMonth() + 1);
  const [tableDate, setTableDate] = useState(new Date().toISOString().split('T')[0]);
  const [tableStartDate, setTableStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [tableEndDate, setTableEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );

  // Active applied filter
  const [appliedFilters, setAppliedFilters] = useState({ filter_type: 'all' });

  // View switch: 'summary' (Roster & Percentages) | 'logs' (Daily / Period Attendance)
  const [viewMode, setViewMode] = useState('summary');
  const [searchQuery, setSearchQuery] = useState('');

  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [exportMode, setExportMode] = useState('monthly'); // 'monthly' | 'custom' | 'yearly'
  const [exportFormat, setExportFormat] = useState('comprehensive'); // 'comprehensive' | 'daily_log'
  const [availableYears, setAvailableYears] = useState([2026, 2025]);
  const [selectedYearDate, setSelectedYearDate] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchAnalytics(appliedFilters);
    fetchAvailableYears();
  }, [departmentId, year]);

  const fetchAvailableYears = async () => {
    try {
      const res = await exportApi.getAvailableYears();
      if (res.data?.years && res.data.years.length > 0) {
        const merged = Array.from(new Set([...res.data.years, 2026, 2025])).sort((a, b) => b - a);
        setAvailableYears(merged);
        setSelectedYearDate(merged[0]);
        setTableYear(merged[0]);
      }
    } catch (err) {
      console.error('Failed to fetch available years:', err);
    }
  };

  const fetchAnalytics = async (filtersToUse = appliedFilters, fromFilterButton = false) => {
    if (fromFilterButton) {
      setIsFiltering(true);
    } else if (!summaryData) {
      setLoading(true);
    }
    setError('');
    try {
      const res = await analyticsApi.getSummary(departmentId, year, filtersToUse);
      setSummaryData(res.data);
    } catch (err) {
      console.error('Failed to fetch department analytics:', err);
      setError(err.response?.data?.detail || 'Failed to load department attendance data.');
    } finally {
      setLoading(false);
      setIsFiltering(false);
    }
  };

  const handleApplyFilter = async (customFilters = null) => {
    let filters = customFilters;
    if (!filters) {
      filters = { filter_type: tableFilterType };
      if (tableFilterType === 'yearly') {
        filters.year_date = tableYear;
      } else if (tableFilterType === 'monthly') {
        filters.year_date = tableYear;
        filters.month = tableMonth;
      } else if (tableFilterType === 'daily') {
        filters.target_date = tableDate;
      } else if (tableFilterType === 'custom') {
        filters.start_date = tableStartDate;
        filters.end_date = tableEndDate;
      }
    }
    setAppliedFilters(filters);
    await fetchAnalytics(filters, true);
  };

  const handleResetFilter = () => {
    setTableFilterType('all');
    handleApplyFilter({ filter_type: 'all' });
  };

  const handleExcelExport = async (overrideFormat = null) => {
    setDownloading(true);
    const formatToUse = overrideFormat || exportFormat;
    try {
      if (exportMode === 'custom') {
        if (!startDate || !endDate) {
          alert('Please select both Start Date and End Date for custom export.');
          return;
        }
        await exportApi.downloadExcel(departmentId, year, 1, selectedYearDate, startDate, endDate, 'custom', formatToUse);
      } else if (exportMode === 'yearly') {
        await exportApi.downloadExcel(departmentId, year, 1, selectedYearDate, null, null, 'yearly', formatToUse);
      } else {
        await exportApi.downloadExcel(departmentId, year, selectedMonth, selectedYearDate, null, null, 'monthly', formatToUse);
      }
    } catch (err) {
      console.error('Failed to export Excel file:', err);
      alert('Failed to download Excel report.');
    } finally {
      setDownloading(false);
    }
  };

  const handleExportDailyTableDirect = async () => {
    setDownloading(true);
    try {
      await exportApi.downloadDailyLogExcel({
        department_id: departmentId,
        year: year,
        export_type: tableFilterType,
        year_date: tableYear,
        month: tableMonth,
        target_date: tableDate,
        start_date: tableStartDate,
        end_date: tableEndDate
      });
    } catch (err) {
      console.error('Failed to export daily table view:', err);
      alert('Failed to download daily table view.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading && !summaryData) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-900 border-t-transparent"></div>
        <p className="text-slate-500 font-medium text-sm">Loading department analytics...</p>
      </div>
    );
  }

  const allStudents = summaryData?.all_students || [];
  const dailyLogs = summaryData?.daily_logs || [];

  const filteredStudents = allStudents.filter(st =>
    st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    st.roll_no.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const shortageCount = filteredStudents.filter(st => st.has_shortage).length;
  const goodCount = filteredStudents.filter(st => !st.has_shortage && st.total_hours_conducted > 0).length;

  const displayedStudents = filteredStudents.filter(st => {
    if (statusFilter === 'shortage') return st.has_shortage;
    if (statusFilter === 'good') return !st.has_shortage && st.total_hours_conducted > 0;
    return true;
  });

  // Group daily logs into date + student rows with columns for Period 1, 2, 3, 4, 5
  const dailyAttendanceMap = {};
  dailyLogs.forEach((log) => {
    const key = `${log.date}_${log.roll_no}`;
    if (!dailyAttendanceMap[key]) {
      dailyAttendanceMap[key] = {
        key,
        date: log.date,
        roll_no: log.roll_no,
        student_name: log.student_name,
        periods: { 1: null, 2: null, 3: null, 4: null, 5: null },
        staffMap: {},
        presentCount: 0,
        absentCount: 0,
        conductedCount: 0
      };
    }
    dailyAttendanceMap[key].periods[log.hour_number] = {
      status: log.status,
      staff_name: log.staff_name,
      staff_initials: log.staff_initials
    };
    dailyAttendanceMap[key].conductedCount += 1;
    if (log.status?.toLowerCase() === 'present' || log.status?.toLowerCase() === 'od') {
      dailyAttendanceMap[key].presentCount += 1;
    } else if (log.status?.toLowerCase() === 'absent') {
      dailyAttendanceMap[key].absentCount += 1;
    }
    if (log.staff_initials) {
      dailyAttendanceMap[key].staffMap[log.staff_initials] = log.staff_name || log.staff_initials;
    }
  });

  const dailyAttendanceRows = Object.values(dailyAttendanceMap).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.roll_no.localeCompare(b.roll_no);
  });

  const filteredDailyRows = dailyAttendanceRows.filter((row) =>
    row.student_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.roll_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.date.includes(searchQuery) ||
    Object.keys(row.staffMap).some((init) => init.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-3 sm:py-8 space-y-4 sm:space-y-8">
      
      {/* Top Header & Export Controls */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToTerminal}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1 cursor-pointer font-bold text-xs shrink-0"
            title="Go to Terminal"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Terminal</span>
          </button>
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="ARIGNAR ANNA COLLEGE" 
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-contain border border-slate-200 bg-white shadow-xs shrink-0" 
            />
            <div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-900 leading-none mb-1">
                ARIGNAR ANNA COLLEGE
              </p>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                {summaryData?.department_name || 'Department'} Dashboard
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Department attendance stats and Excel reporting
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls & Export Button */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-start md:justify-end">
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
            <label className="block text-[9px] uppercase font-bold text-slate-500">Academic Class</label>
            <select
              value={year}
              onChange={(e) => onYearChange(parseInt(e.target.value))}
              className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value={1} className="bg-white text-slate-900">1st Year</option>
              <option value={2} className="bg-white text-slate-900">2nd Year</option>
              <option value={3} className="bg-white text-slate-900">3rd Year</option>
            </select>
          </div>

          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
            <label className="block text-[9px] uppercase font-bold text-slate-500">Report Format</label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="comprehensive" className="bg-white text-slate-900">📊 Comprehensive (.xlsx)</option>
              <option value="daily_log" className="bg-white text-slate-900">📋 Daily Table View (.xlsx)</option>
            </select>
          </div>

          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
            <label className="block text-[9px] uppercase font-bold text-slate-500">Export Mode</label>
            <select
              value={exportMode}
              onChange={(e) => setExportMode(e.target.value)}
              className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
            >
              <option value="monthly" className="bg-white text-slate-900">By Month</option>
              <option value="custom" className="bg-white text-slate-900">Custom Date Range</option>
              <option value="yearly" className="bg-white text-slate-900">Full Academic Year</option>
            </select>
          </div>

          {exportMode !== 'custom' && (
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
              <label className="block text-[9px] uppercase font-bold text-slate-500">Calendar Year</label>
              <select
                value={selectedYearDate}
                onChange={(e) => setSelectedYearDate(parseInt(e.target.value))}
                className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y} className="bg-white text-slate-900">
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {exportMode === 'monthly' && (
            <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
              <label className="block text-[9px] uppercase font-bold text-slate-500">Export Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                  <option key={m} value={m} className="bg-white text-slate-900">
                    Month {m} ({new Date(selectedYearDate, m - 1, 1).toLocaleString('default', { month: 'short' })})
                  </option>
                ))}
              </select>
            </div>
          )}

          {exportMode === 'custom' && (
            <>
              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
                <label className="block text-[9px] uppercase font-bold text-slate-500">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>

              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300">
                <label className="block text-[9px] uppercase font-bold text-slate-500">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                />
              </div>
            </>
          )}

          <button
            onClick={() => handleExcelExport()}
            disabled={downloading}
            className="col-span-2 sm:col-span-1 w-full sm:w-auto px-5 py-3 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            title={`Download ${exportFormat === 'daily_log' ? 'Daily Attendance Table View' : 'Comprehensive'} Excel report`}
          >
            {downloading ? (
              <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                Export {exportFormat === 'daily_log' ? 'Daily Table' : 'Excel'} (.xlsx)
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs sm:text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200">
            <Users className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium block">Total Students</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">{summaryData?.total_students || 0}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Year {year} Roster</span>
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
            <UserCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <span className="text-xs text-emerald-700 font-medium block">
              {appliedFilters.filter_type === 'all' || appliedFilters.filter_type === 'daily' ? "Present Today" : "Present in Period"}
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-800">
              {summaryData?.period_present ?? summaryData?.today_present ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {appliedFilters.filter_type === 'all' || appliedFilters.filter_type === 'daily' ? "Today's Attendance" : "Period Attendance"}
            </span>
          </div>
        </div>

        <div className="bg-white border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200">
            <UserX className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <span className="text-xs text-rose-700 font-medium block">
              {appliedFilters.filter_type === 'all' || appliedFilters.filter_type === 'daily' ? "Absent Today" : "Absent in Period"}
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-800">
              {summaryData?.period_absent ?? summaryData?.today_absent ?? 0}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {appliedFilters.filter_type === 'all' || appliedFilters.filter_type === 'daily' ? "Today's Absences" : "Period Absences"}
            </span>
          </div>
        </div>

        <div className="bg-white border border-blue-200 rounded-2xl p-4 sm:p-5 shadow-xs flex items-center gap-3 sm:gap-4">
          <div className="p-3 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200">
            <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <span className="text-xs text-blue-800 font-medium block">Class Average</span>
            <span className="text-xl sm:text-2xl font-black text-blue-950">{summaryData?.class_average_percentage || 0}%</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {summaryData?.filter_label || 'All Days'}
            </span>
          </div>
        </div>
      </div>

      {/* Attendance Table Card with Dedicated Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-lg">
        
        {/* Card Header with Title and Active Badge */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {summaryData?.department_name} (Year {year}) Attendance Table
              </h3>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                Showing: {summaryData?.filter_label || 'All Days & Years'}
              </span>
              {summaryData?.total_hours_in_period > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                  {summaryData.total_hours_in_period} Total Conducted Hour{summaryData.total_hours_in_period > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Filter attendance records across all days, months, and years using the filter controls below.
            </p>
          </div>

          {/* Right Control Toggles: View Mode & Mobile Responsive Display Mode */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* View Mode Toggle: Summary Roster vs Daily Period Logs */}
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1 border border-slate-300 overflow-x-auto no-scrollbar justify-center">
              <button
                onClick={() => setViewMode('summary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                  viewMode === 'summary'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ListChecks className="w-3.5 h-3.5" />
                Summary Roster
              </button>
              <button
                onClick={() => setViewMode('logs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                  viewMode === 'logs'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Daily Attendance ({dailyAttendanceRows.length})
              </button>
            </div>

            {/* Display Mode Toggle: Mobile Cards vs Full Table */}
            <div className="inline-flex rounded-xl bg-slate-200/80 p-1 border border-slate-300">
              <button
                type="button"
                onClick={() => setDisplayMode('cards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'cards'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Mobile Cards view (Touch-friendly for smartphones)"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-900" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'table'
                    ? 'bg-white text-blue-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Full Matrix Table view"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Status Filter Chips for Summary Roster */}
        {viewMode === 'summary' && (
          <div className="px-4 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase font-black text-slate-400 shrink-0">Quick Filter:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              All ({filteredStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('shortage')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'shortage'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              Shortage &lt;75% ({shortageCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('good')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                statusFilter === 'good'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Good ≥75% ({goodCount})
            </button>
          </div>
        )}

        {/* Filter Controls Bar with Filter Button and Quick Presets */}
        <div className="p-4 bg-slate-100/70 border-b border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-1">
              
              {/* Filter Mode Selector */}
              <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                <label className="block text-[9px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3 text-slate-400" />
                  Filter Timeframe
                </label>
                <select
                  value={tableFilterType}
                  onChange={(e) => setTableFilterType(e.target.value)}
                  className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Days & Years (All Time)</option>
                  <option value="monthly">By Month</option>
                  <option value="yearly">By Year</option>
                  <option value="daily">By Specific Day</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {/* Year Selector for Monthly & Yearly */}
              {(tableFilterType === 'monthly' || tableFilterType === 'yearly') && (
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">Year</label>
                  <select
                    value={tableYear}
                    onChange={(e) => setTableYear(parseInt(e.target.value))}
                    className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Month Selector for Monthly */}
              {tableFilterType === 'monthly' && (
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">Month</label>
                  <select
                    value={tableMonth}
                    onChange={(e) => setTableMonth(parseInt(e.target.value))}
                    className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
                      <option key={m} value={m}>
                        Month {m} ({new Date(tableYear, m - 1, 1).toLocaleString('default', { month: 'short' })})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Date Selector for Specific Day */}
              {tableFilterType === 'daily' && (
                <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <label className="block text-[9px] uppercase font-bold text-slate-500">Select Date</label>
                  <input
                    type="date"
                    value={tableDate}
                    onChange={(e) => setTableDate(e.target.value)}
                    className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                  />
                </div>
              )}

              {/* Custom Range: Start & End */}
              {tableFilterType === 'custom' && (
                <>
                  <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                    <label className="block text-[9px] uppercase font-bold text-slate-500">Start Date</label>
                    <input
                      type="date"
                      value={tableStartDate}
                      onChange={(e) => setTableStartDate(e.target.value)}
                      className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                    />
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                    <label className="block text-[9px] uppercase font-bold text-slate-500">End Date</label>
                    <input
                      type="date"
                      value={tableEndDate}
                      onChange={(e) => setTableEndDate(e.target.value)}
                      className="bg-transparent text-slate-900 text-xs font-bold focus:outline-none cursor-pointer"
                    />
                  </div>
                </>
              )}

              {/* Action Buttons: Filter Button & Reset Button */}
              <button
                onClick={() => handleApplyFilter()}
                disabled={isFiltering}
                className="px-4 py-2.5 bg-blue-900 hover:bg-blue-950 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                title="Apply selected filter"
              >
                {isFiltering ? (
                  <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
                ) : (
                  <Filter className="w-4 h-4" />
                )}
                <span>{isFiltering ? 'Filtering...' : 'Filter'}</span>
              </button>

              {tableFilterType !== 'all' && (
                <button
                  onClick={handleResetFilter}
                  disabled={isFiltering}
                  className="px-3 py-2.5 bg-slate-200 hover:bg-slate-300 active:scale-[0.98] text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="Reset to All Days & Years"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Show All</span>
                </button>
              )}
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search student or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Zero Sessions Conducted Notification Banner */}
        {summaryData?.total_hours_in_period === 0 && (
          <div className="m-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-900">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">No sessions found for {summaryData?.filter_label}.</span>
                <span className="block text-[11px] text-amber-700 mt-0.5">
                  Zero hours were recorded during this timeframe. Try selecting another month, date, or academic year.
                </span>
              </div>
            </div>
            <button
              onClick={handleResetFilter}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-all shrink-0 cursor-pointer"
            >
              Show All Days
            </button>
          </div>
        )}

        {/* View 1: Summary Roster */}
        {viewMode === 'summary' && (
          displayMode === 'cards' ? (
            /* Mobile-Optimized Cards View */
            <div className={`p-3 sm:p-5 transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              {displayedStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <p className="font-bold text-sm">No student records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try changing the search or status filter.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {displayedStudents.map((st) => (
                    <div
                      key={st.roll_no}
                      className={`bg-white border rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between space-y-3 ${
                        st.has_shortage
                          ? 'border-rose-300 ring-1 ring-rose-200/70 bg-rose-50/20'
                          : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {/* Top Header: Roll No badge + Status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs">
                          {st.roll_no}
                        </span>
                        {st.total_hours_conducted === 0 ? (
                          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            No Sessions
                          </span>
                        ) : st.has_shortage ? (
                          <span className="text-[11px] font-extrabold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                            Shortage &lt;75%
                          </span>
                        ) : (
                          <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            Satisfactory
                          </span>
                        )}
                      </div>

                      {/* Student Name */}
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{st.name}</h4>
                      </div>

                      {/* Visual Progress Bar & Big % */}
                      <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Attendance Rate</span>
                          <span className={`font-mono font-black text-sm ${st.has_shortage ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {st.attendance_percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              st.has_shortage ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(st.attendance_percentage, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Breakdown Tally Badges */}
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                        <div className="bg-slate-100 py-1.5 px-1 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[9px]">TOTAL</span>
                          <span className="text-slate-800 font-black">{st.total_hours_conducted}h</span>
                        </div>
                        <div className="bg-emerald-50 py-1.5 px-1 rounded-lg border border-emerald-200">
                          <span className="text-emerald-600 block text-[9px]">PRES</span>
                          <span className="text-emerald-800 font-black">{st.present_hours}</span>
                        </div>
                        <div className="bg-rose-50 py-1.5 px-1 rounded-lg border border-rose-200">
                          <span className="text-rose-600 block text-[9px]">ABS</span>
                          <span className="text-rose-800 font-black">{st.absent_hours}</span>
                        </div>
                        <div className="bg-amber-50 py-1.5 px-1 rounded-lg border border-amber-200">
                          <span className="text-amber-700 block text-[9px]">OD</span>
                          <span className="text-amber-900 font-black">{st.od_hours}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Desktop Full Matrix Table View */
            <div className={`table-scrollbar transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead className="sticky top-0 z-20 shadow-xs">
                  <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Roll No</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Student Name</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Hours</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Present</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Absent</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">OD</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 text-center">Attendance %</th>
                    <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium">
                  {displayedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        No student records found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    displayedStudents.map((st) => (
                      <tr key={st.roll_no} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 sm:px-6 font-mono font-extrabold text-blue-900">{st.roll_no}</td>
                        <td className="py-3.5 px-4 sm:px-6 font-bold text-slate-900">{st.name}</td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-700">{st.total_hours_conducted}</td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-700">{st.present_hours}</td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-700">{st.absent_hours}</td>
                        <td className="py-3.5 px-3 text-center font-mono font-bold text-amber-700">{st.od_hours}</td>
                        <td className="py-3.5 px-4 text-center">
                          {st.total_hours_conducted === 0 ? (
                            <span className="font-mono font-bold px-2.5 py-1 rounded-xl text-xs bg-slate-100 text-slate-400 border border-slate-200">
                              0.0%
                            </span>
                          ) : (
                            <span
                              className={`font-mono font-extrabold px-2.5 py-1 rounded-xl text-xs ${
                                st.has_shortage
                                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              }`}
                            >
                              {st.attendance_percentage}%
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {st.total_hours_conducted === 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                              No Sessions
                            </span>
                          ) : st.attendance_percentage < 75 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              &lt;75%
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Satisfactory
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* View 2: Detailed Daily Attendance Table with Separate Period 1 to 5 Columns */}
        {viewMode === 'logs' && (
          <div className="space-y-3">
            {/* Quick Export Bar for Daily Attendance Table */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-700 shrink-0" />
                <span className="font-extrabold text-slate-800">
                  Daily Period Attendance View
                </span>
                <span className="text-slate-500 font-medium">
                  ({filteredDailyRows.length} daily entries)
                </span>
              </div>
              <button
                onClick={handleExportDailyTableDirect}
                disabled={downloading}
                className="w-full sm:w-auto px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Download this filtered daily table directly as Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Daily Table (.xlsx)</span>
              </button>
            </div>

            {displayMode === 'cards' ? (
              /* Mobile Daily Attendance Cards View */
              <div className={`p-3 sm:p-5 transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
                {filteredDailyRows.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <p className="font-bold text-sm">No daily attendance records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try selecting another timeframe or class year.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {filteredDailyRows.map((row) => (
                      <div
                        key={row.key}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 hover:border-blue-300 transition-all"
                      >
                        {/* Top Header: Date badge + Roll No */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                            {row.date}
                          </span>
                          <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 shadow-2xs">
                            {row.roll_no}
                          </span>
                        </div>

                        {/* Student Name */}
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900">{row.student_name}</h4>
                        </div>

                        {/* 5-Period Status Micro-Row */}
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-bold text-slate-400">Periods (1 – 5)</span>
                          <div className="grid grid-cols-5 gap-1 text-center">
                            {[1, 2, 3, 4, 5].map((periodNum) => {
                              const p = row.periods[periodNum];
                              if (!p || !p.status) {
                                return (
                                  <div
                                    key={periodNum}
                                    className="py-1.5 px-0.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-300 font-mono text-[10px]"
                                  >
                                    <span className="block text-[8px] text-slate-400 font-bold">P{periodNum}</span>
                                    -
                                  </div>
                                );
                              }
                              const sLower = p.status.toLowerCase();
                              const isPres = sLower === 'present';
                              const isAbs = sLower === 'absent';
                              const isOd = sLower === 'od';

                              return (
                                <div
                                  key={periodNum}
                                  className={`py-1.5 px-0.5 rounded-xl border text-[10px] font-black ${
                                    isPres
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : isAbs
                                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                                      : isOd
                                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                  title={p.staff_name ? `Taken by ${p.staff_name}` : undefined}
                                >
                                  <span className="block text-[8px] opacity-75 font-bold">P{periodNum}</span>
                                  {isPres ? '✓ Pres' : isAbs ? '✗ Abs' : isOd ? '⏱ OD' : p.status}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Bottom Summary Bar: Score + Staff attribution */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-500 font-bold">Day Total:</span>
                            <span className="font-mono font-black text-slate-900 text-xs">
                              {row.presentCount} / {row.conductedCount}
                            </span>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              ({row.conductedCount > 0 ? `${Math.round((row.presentCount / row.conductedCount) * 100)}%` : '0%'})
                            </span>
                          </div>
                          {Object.keys(row.staffMap).length > 0 && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200">
                              By: {Object.keys(row.staffMap).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Desktop Matrix Table View */
              <div className={`table-scrollbar transition-opacity ${isFiltering ? 'opacity-50 pointer-events-none' : ''}`}>
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead className="sticky top-0 z-20 shadow-xs">
                    <tr className="bg-slate-100 text-slate-700 text-xs font-extrabold uppercase border-b border-slate-200">
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Date</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 font-mono">Roll No</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4">Student Name</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 1</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 2</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 3</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 4</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center min-w-[95px]">Period 5</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-3 text-center">Day Total</th>
                      <th className="sticky top-0 z-20 bg-slate-100 py-3.5 px-4 sm:px-6">Attendance Taken By (Staff)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs sm:text-sm font-medium">
                    {filteredDailyRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          No daily attendance records found matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredDailyRows.map((row) => (
                        <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 sm:px-6 font-mono text-slate-800 font-semibold whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-3 px-4 font-mono font-extrabold text-blue-900">
                            {row.roll_no}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {row.student_name}
                          </td>

                          {/* Period 1 to 5 Columns */}
                          {[1, 2, 3, 4, 5].map((hour) => {
                            const pData = row.periods[hour];
                            if (!pData) {
                              return (
                                <td key={hour} className="py-3 px-3 text-center text-slate-300 font-bold text-xs">
                                  -
                                </td>
                              );
                            }
                            const isPresent = pData.status?.toLowerCase() === 'present';
                            const isAbsent = pData.status?.toLowerCase() === 'absent';

                            return (
                              <td key={hour} className="py-3 px-3 text-center">
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black uppercase tracking-wide ${
                                      isPresent
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : isAbsent
                                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                                    }`}
                                  >
                                    {isPresent ? 'Present' : isAbsent ? 'Absent' : 'OD'}
                                  </span>
                                  {pData.staff_initials && (
                                    <span
                                      className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1 rounded border border-slate-200"
                                      title={pData.staff_name ? `Taken by ${pData.staff_name}` : `Staff: ${pData.staff_initials}`}
                                    >
                                      {pData.staff_initials}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          {/* Day Total Present / Conducted */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span className="font-mono font-bold text-xs text-slate-800">
                              {row.presentCount}/{row.conductedCount}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-semibold">
                              {row.conductedCount > 0 ? `${Math.round((row.presentCount / row.conductedCount) * 100)}%` : '0%'}
                            </span>
                          </td>

                          {/* Staff Taken By Attribution */}
                          <td className="py-3 px-4 sm:px-6">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {Object.keys(row.staffMap).length === 0 ? (
                                <span className="text-slate-400 text-xs">-</span>
                              ) : (
                                Object.entries(row.staffMap).map(([initials, name]) => (
                                  <span
                                    key={initials}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 text-xs font-medium"
                                    title={name}
                                  >
                                    <span className="font-mono font-black text-[10px] bg-blue-200/80 px-1 rounded text-blue-950">
                                      {initials}
                                    </span>
                                    <span className="truncate max-w-[120px]">{name}</span>
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
