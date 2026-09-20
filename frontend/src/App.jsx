import React, { useState, useEffect } from 'react';
import { authApi } from './api';
import Header from './components/Header';
import KioskLogin from './components/KioskLogin';
import AttendanceGrid from './components/AttendanceGrid';
import AdminDashboard from './components/AdminDashboard';
import AdminManagement from './components/AdminManagement';
import CalendarManagement from './components/CalendarManagement';
import StaffPortal from './components/StaffPortal';
import DepartmentDashboard from './components/DepartmentDashboard';
import UnifiedLogin from './components/UnifiedLogin';
import { 
  Monitor, LayoutDashboard, UserCheck, Settings, LogOut, 
  GraduationCap, Menu, X, ArrowLeft, Calendar as CalendarIcon
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activePortal, setActivePortal] = useState('admin_analytics');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Terminal Kiosk State for Home Page Launcher
  const [terminalState, setTerminalState] = useState(null); // null | 'kiosk_login' | 'grid_active'
  const [terminalConfig, setTerminalConfig] = useState(null);

  const periodSlots = {
    1: ["10:00", "10:30"],
    2: ["11:00", "11:30"],
    3: ["12:00", "12:30"],
    4: ["13:30", "14:00"],
    5: ["14:30", "15:00"]
  };

  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [selectedYear, setSelectedYear] = useState('all');

  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    const token = localStorage.getItem('active_jwt_token');
    if (!token) return;
    try {
      const meRes = await authApi.getMe();
      const user = meRes.data;
      setCurrentUser(user);
      routeUserToPortal(user);
    } catch (err) {
      console.error('Session expired:', err);
      handleLogout();
    }
  };

  const routeUserToPortal = (user) => {
    if (user.role === 'Admin') {
      setActivePortal('admin_analytics');
      setSelectedDeptId('all');
      setSelectedYear('all');
    } else if (user.role === 'Department') {
      setActivePortal('department_dashboard');
      if (user.department_id) setSelectedDeptId(user.department_id);
      setSelectedYear(1);
    } else if (user.role === 'Staff') {
      setActivePortal('staff_portal');
      if (user.department_id) setSelectedDeptId(user.department_id);
      setSelectedYear(1);
    }
  };

  const handleLoginSuccess = (loginData) => {
    setCurrentUser(loginData);
    setTerminalState(null);
    routeUserToPortal(loginData);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore if already revoked or network error
    }
    localStorage.removeItem('active_jwt_token');
    localStorage.removeItem('kiosk_jwt_token');
    localStorage.removeItem('kiosk_submission_token');
    setCurrentUser(null);
    setTerminalState(null);
    setTerminalConfig(null);
    setMobileMenuOpen(false);
  };

  const handleTerminalConfigured = (configData) => {
    setTerminalConfig(configData);
    setTerminalState('grid_active');
  };

  const handleExitTerminal = () => {
    setTerminalState(null);
    setTerminalConfig(null);
  };

  const handleSwitchClass = async ({ departmentId, departmentName, year }) => {
    if (!terminalConfig) return;
    const targetDeptId = departmentId !== undefined ? departmentId : terminalConfig.departmentId;
    const targetDeptName = departmentName !== undefined ? departmentName : terminalConfig.departmentName;
    const targetYear = year !== undefined ? year : terminalConfig.year;

    try {
      if (departmentId !== undefined && departmentId !== terminalConfig.departmentId && terminalConfig.unlockedStaff?.staff_id) {
        const res = await authApi.selectKioskDepartment({
          staff_id: terminalConfig.unlockedStaff.staff_id,
          department_id: targetDeptId,
          hour_number: terminalConfig.unlockedHour
        });
        localStorage.setItem('kiosk_submission_token', res.data.access_token);
        setTerminalConfig(prev => ({
          ...prev,
          departmentId: targetDeptId,
          departmentName: targetDeptName,
          year: targetYear,
          token: res.data.access_token
        }));
        return;
      }
    } catch (err) {
      console.warn('Could not re-scope kiosk token during class switch, proceeding with current session:', err);
    }

    setTerminalConfig(prev => ({
      ...prev,
      departmentId: targetDeptId,
      departmentName: targetDeptName,
      year: targetYear
    }));
  };

  const handleGoBack = () => {
    if (currentUser?.role === 'Admin') {
      if (activePortal !== 'admin_analytics') {
        setActivePortal('admin_analytics');
      } else {
        handleLogout();
      }
    } else {
      handleLogout();
    }
  };

  // 1. ACTIVE ATTENDANCE TERMINAL KIOSK (Available both logged out & logged in)
  if (terminalState === 'kiosk_login') {
    return (
      <KioskLogin
        onTerminalConfigured={handleTerminalConfigured}
        onBack={handleExitTerminal}
        defaultInitials={currentUser?.role === 'Staff' ? (currentUser.initials || currentUser.username) : ''}
      />
    );
  }

  if (terminalState === 'grid_active' && terminalConfig) {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
        <Header
          terminalName={`${terminalConfig.departmentName} (Year ${terminalConfig.year})`}
          unlockedStaff={terminalConfig.unlockedStaff}
          activePeriod={terminalConfig.unlockedHour}
          periodSlots={periodSlots}
          onLockTerminal={handleExitTerminal}
        />
        <main className="flex-1 pb-16">
          <AttendanceGrid
            departmentId={terminalConfig.departmentId}
            departmentName={terminalConfig.departmentName}
            year={terminalConfig.year}
            unlockedHour={terminalConfig.unlockedHour}
            unlockedStaff={terminalConfig.unlockedStaff}
            periodSlots={periodSlots}
            onBackToHome={handleExitTerminal}
            onAttendanceSubmitted={handleExitTerminal}
            onSwitchClass={handleSwitchClass}
          />
        </main>
      </div>
    );
  }

  // 2. UNAUTHENTICATED USER AT HOME PAGE
  if (!currentUser) {
    return (
      <UnifiedLogin
        onLoginSuccess={handleLoginSuccess}
        onLaunchTerminal={() => setTerminalState('kiosk_login')}
      />
    );
  }

  // 2. AUTHENTICATED CONSTANT DASHBOARDS (Admin, Department, Staff)
  const userInitials = (currentUser.username || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50/60 bg-grid-subtle text-slate-900 flex flex-col font-sans selection:bg-blue-900 selection:text-white">
      
      {/* Top Academic Navigation Bar */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 py-2.5 flex items-center justify-between text-xs font-bold sticky top-0 z-40 shadow-xs">
        
        {/* College Logo / Badge & Back Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleGoBack}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer font-bold active:scale-95"
            title="Go Back to Home"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline text-xs">Back</span>
          </button>

          <div className="flex items-center gap-2.5">
            <img 
              src="/logo.png" 
              alt="ARIGNAR ANNA COLLEGE" 
              className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl border border-blue-200 shadow-2xs bg-white" 
            />
            <div>
              <span className="text-slate-900 text-xs sm:text-sm font-black uppercase tracking-wider block leading-tight">
                ARIGNAR ANNA COLLEGE
              </span>
              <span className="text-[10px] text-blue-700 font-bold block leading-none mt-0.5">
                Academic Management Portal
              </span>
            </div>
          </div>
        </div>

        {/* User Badge & Desktop Portal Buttons */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Quick Launch Terminal Button for All Authenticated Users */}
          <button
            onClick={() => setTerminalState('kiosk_login')}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Launch Classroom Attendance Terminal"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Take Attendance</span>
          </button>

          {/* User Profile Pill */}
          <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200 px-3 py-1 rounded-xl shadow-2xs">
            <div className="w-6 h-6 rounded-lg bg-blue-900 text-white flex items-center justify-center font-black text-[10px]">
              {userInitials}
            </div>
            <span className="text-slate-900 font-extrabold">{currentUser.username}</span>
            <span className="px-2 py-0.5 rounded-md text-[9px] uppercase font-black bg-blue-100 text-blue-900 border border-blue-200">
              {currentUser.role}
            </span>
          </div>

          {currentUser.role === 'Admin' && (
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 gap-1">
              <button
                onClick={() => setActivePortal('admin_analytics')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  activePortal === 'admin_analytics'
                    ? 'bg-blue-900 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Global Analytics</span>
              </button>
              <button
                onClick={() => setActivePortal('admin_manage')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  activePortal === 'admin_manage'
                    ? 'bg-blue-900 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Admin Setup</span>
              </button>
              <button
                onClick={() => setActivePortal('admin_calendar')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-xs ${
                  activePortal === 'admin_calendar'
                    ? 'bg-blue-900 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Calendar & Holidays</span>
              </button>
            </div>
          )}

          {currentUser.role === 'Department' && (
            <button
              onClick={() => setActivePortal('department_dashboard')}
              className="px-3.5 py-1.5 rounded-xl bg-blue-900 text-white shadow-xs font-black flex items-center gap-1.5"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Department Dashboard</span>
            </button>
          )}

          {currentUser.role === 'Staff' && (
            <button
              onClick={() => setActivePortal('staff_portal')}
              className="px-3.5 py-1.5 rounded-xl bg-blue-900 text-white shadow-xs font-black flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Staff History Portal</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all flex items-center gap-1.5 cursor-pointer font-bold shadow-2xs active:scale-95"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>

        {/* Mobile Menu Action Buttons */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            onClick={() => setTerminalState('kiosk_login')}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-black flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Take Attendance"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Terminal</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-slate-700 focus:outline-none cursor-pointer transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/95 backdrop-blur-md border-b border-slate-200 p-4 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-150 z-30">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
            <span className="text-slate-600">User: <strong className="text-blue-900">{currentUser.username}</strong></span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
              {currentUser.role}
            </span>
          </div>

          <div className="space-y-2">
            {/* Prominent Classroom Attendance Terminal in Mobile Drawer */}
            <button
              onClick={() => { setTerminalState('kiosk_login'); setMobileMenuOpen(false); }}
              className="w-full p-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-left font-black text-xs flex items-center justify-between shadow-sm cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Monitor className="w-4 h-4" />
                <span>Take Attendance (Terminal)</span>
              </div>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">Kiosk</span>
            </button>
            {currentUser.role === 'Admin' && (
              <>
                <button
                  onClick={() => { setActivePortal('admin_analytics'); setMobileMenuOpen(false); }}
                  className="w-full p-3 rounded-xl bg-slate-100 text-left font-bold text-xs flex items-center gap-2 text-slate-800 border border-slate-200"
                >
                  <LayoutDashboard className="w-4 h-4 text-blue-700" />
                  Global Analytics & Excel Export
                </button>
                <button
                  onClick={() => { setActivePortal('admin_manage'); setMobileMenuOpen(false); }}
                  className="w-full p-3 rounded-xl bg-slate-100 text-left font-bold text-xs flex items-center gap-2 text-slate-800 border border-slate-200"
                >
                  <Settings className="w-4 h-4 text-blue-700" />
                  Admin System Setup
                </button>
                <button
                  onClick={() => { setActivePortal('admin_calendar'); setMobileMenuOpen(false); }}
                  className="w-full p-3 rounded-xl bg-slate-100 text-left font-bold text-xs flex items-center gap-2 text-slate-800 border border-slate-200"
                >
                  <CalendarIcon className="w-4 h-4 text-blue-700" />
                  Academic Calendar & Holidays
                </button>
              </>
            )}

            {currentUser.role === 'Department' && (
              <button
                onClick={() => { setActivePortal('department_dashboard'); setMobileMenuOpen(false); }}
                className="w-full p-3 rounded-xl bg-blue-900 text-white text-left font-black text-xs flex items-center gap-2 shadow-sm"
              >
                <LayoutDashboard className="w-4 h-4" />
                Department Dashboard & Excel
              </button>
            )}

            {currentUser.role === 'Staff' && (
              <button
                onClick={() => { setActivePortal('staff_portal'); setMobileMenuOpen(false); }}
                className="w-full p-3 rounded-xl bg-blue-900 text-white text-left font-black text-xs flex items-center gap-2 shadow-sm"
              >
                <UserCheck className="w-4 h-4" />
                Staff History Portal
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-left font-bold text-xs flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Log Out to Home
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        
        {/* CONSTANT DASHBOARD 1: DEPARTMENT DASHBOARD */}
        {currentUser.role === 'Department' && (
          <DepartmentDashboard
            departmentId={selectedDeptId}
            year={selectedYear === 'all' ? 1 : selectedYear}
            onYearChange={setSelectedYear}
            onBackToTerminal={() => setTerminalState('kiosk_login')}
            onLaunchTerminal={() => setTerminalState('kiosk_login')}
          />
        )}

        {/* CONSTANT DASHBOARD 2: ADMIN MANAGEMENT (CRUD) */}
        {currentUser.role === 'Admin' && activePortal === 'admin_manage' && (
          <AdminManagement />
        )}

        {/* CONSTANT DASHBOARD 3: ADMIN ACADEMIC CALENDAR MANAGEMENT */}
        {currentUser.role === 'Admin' && activePortal === 'admin_calendar' && (
          <CalendarManagement />
        )}

        {/* CONSTANT DASHBOARD 4: ADMIN GLOBAL ANALYTICS & EXCEL */}
        {currentUser.role === 'Admin' && activePortal === 'admin_analytics' && (
          <AdminDashboard
            departmentId={selectedDeptId}
            year={selectedYear}
            onDepartmentChange={setSelectedDeptId}
            onYearChange={setSelectedYear}
          />
        )}

        {/* CONSTANT DASHBOARD 3: STAFF PERSONAL HISTORY PORTAL */}
        {currentUser.role === 'Staff' && (
          <StaffPortal 
            onLaunchTerminal={() => setTerminalState('kiosk_login')}
          />
        )}

      </main>
    </div>
  );
}

