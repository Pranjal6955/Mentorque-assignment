import { useState, useEffect, useCallback, useRef } from "react";
import { Outlet, NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import MentorqueBrand from "./MentorqueLogo";
import { getNotifications } from "../api/meetings";
import { Calendar, Users, LayoutGrid, LogOut, Settings, Check, Bell, CheckCircle2, XCircle, Clock } from "lucide-react";

function capitalize(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatDisplayName(name, email) {
  const trimmed = name?.trim();
  if (trimmed && !trimmed.includes("@")) {
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map(capitalize)
      .join(" ");
  }
  const first = email?.split("@")[0]?.split(/[._-]+/).filter(Boolean)[0];
  return first ? capitalize(first) : "User";
}

function getInitials(name, email) {
  const trimmed = name?.trim();
  if (trimmed && !trimmed.includes("@")) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = email?.split("@")[0]?.split(/[._-]+/).filter(Boolean)[0] || "";
  return first.slice(0, 2).toUpperCase() || "?";
}

function navLinkClass({ isActive }) {
  return `inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
    isActive
      ? "bg-primary-500 text-black"
      : "text-slate-400 hover:bg-navy-800 hover:text-white"
  }`;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const popoverRef = useRef(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await getNotifications();
      if (res?.success && Array.isArray(res.logs)) {
        setLogs(res.logs);
        const readIds = JSON.parse(localStorage.getItem("mq_read_notifs") || "[]");
        const unread = res.logs.filter((l) => !readIds.includes(l.id)).length;
        setUnreadCount(unread);
      }
    } catch {
      // ignore error
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const markAllRead = () => {
    const ids = logs.map((l) => l.id);
    localStorage.setItem("mq_read_notifs", JSON.stringify(ids));
    setUnreadCount(0);
  };

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) markAllRead();
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={handleToggle}
        title="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-navy-900 text-slate-300 transition-colors hover:bg-navy-800 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-md">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border border-white/[0.1] bg-navy-900 p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary-400" />
              Notification Center
            </h3>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
              {logs.length} Total
            </span>
          </div>

          <div className="mq-scroll max-h-80 overflow-y-auto space-y-2 mt-3 pr-1">
            {logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No notification alerts yet.
              </div>
            ) : (
              logs.map((log) => {
                const isBooked = log.eventType === "MEETING_BOOKED";
                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-white/[0.06] bg-navy-950 p-3 hover:border-white/20 transition space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5 line-clamp-1">
                        {isBooked ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        )}
                        <span>{log.subject}</span>
                      </h4>
                      <span className="text-[9px] font-mono text-slate-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.recipients && log.recipients.length > 0 && (
                      <p className="text-[10px] text-slate-400 truncate">
                        <span className="text-slate-500">To:</span> {log.recipients.join(", ")}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu({ name, email, role, onLogout }) {
  const display = formatDisplayName(name, email);
  const initials = getInitials(name, email);

  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 items-center gap-2.5" title={email || undefined}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-500/40 bg-primary-500/10"
          aria-hidden
        >
          <span className="text-xs font-bold leading-none text-primary-400">{initials}</span>
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="max-w-[8rem] truncate text-xs font-semibold text-white">{display}</p>
          {role && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary-400">{role}</p>
          )}
        </div>
      </div>
      <div className="hidden h-6 w-px bg-navy-700 sm:block" aria-hidden />
      <button
        type="button"
        onClick={onLogout}
        title="Sign out"
        aria-label="Sign out"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function HeaderBrand() {
  return (
    <Link to="/" className="flex shrink-0 items-center">
      <MentorqueBrand />
    </Link>
  );
}

function AvailabilityLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
      <span className="inline-flex items-center gap-2">
        <span className="mq-slot-check h-3 w-3 flex items-center justify-center bg-primary-500 text-black rounded-full" aria-hidden>
          <Check className="h-2 w-2 text-black stroke-[3]" />
        </span>
        Available
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-5 shrink-0 rounded-md bg-white/[0.06] border border-white/[0.08]" aria-hidden />
        Unavailable
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-5 shrink-0 rounded-md bg-navy-950/80 ring-1 ring-inset ring-white/[0.06]"
          aria-hidden
        />
        Past
      </span>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const email = user?.email ?? "";

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setScrolled(window.scrollY > 12);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const schedulePath = user?.role === "MENTOR" ? "/mentor" : "/availability";
  const scheduleLabel = user?.role === "MENTOR" ? "Mentor Schedule" : "Your Schedule";
  const showAvailabilityLegend =
    location.pathname === "/availability" ||
    location.pathname === "/mentor" ||
    location.pathname === "/admin/schedules";

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col">
      <header
        className={`sticky top-0 z-50 isolate transition-[background-color,box-shadow,border-color] duration-300 ease-out ${
          scrolled
            ? "border-b border-navy-800 bg-navy-950/90 backdrop-blur-xl"
            : "bg-transparent shadow-none"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <HeaderBrand />

            <nav className="flex items-center gap-1.5">
              {user?.role === "ADMIN" ? (
                <>
                  <NavLink to="/admin" end className={navLinkClass}>
                    <LayoutGrid className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Admin Hub</span>
                  </NavLink>
                  <NavLink to="/mentor" className={navLinkClass}>
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">Mentor View</span>
                  </NavLink>
                  <NavLink to="/availability" className={navLinkClass}>
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline">User View</span>
                  </NavLink>
                  <NavLink to="/admin/schedules" className={navLinkClass}>
                    <Users className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">Team Schedules</span>
                  </NavLink>
                </>
              ) : user?.role === "MENTOR" ? (
                <NavLink to="/mentor" className={navLinkClass}>
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Mentor Schedule</span>
                </NavLink>
              ) : (
                <NavLink to="/availability" className={navLinkClass}>
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span>Your Schedule</span>
                </NavLink>
              )}
            </nav>

          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserMenu name={user?.name} email={email} role={user?.role} onLogout={handleLogout} />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 pb-16">
        <Outlet />
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-800 bg-navy-900/90 backdrop-blur-xl">
        <div className="mx-auto flex h-11 w-full max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          {showAvailabilityLegend ? (
            <AvailabilityLegend />
          ) : (
            <span className="text-xs text-slate-400">Mentorque Scheduling Platform</span>
          )}
        </div>
      </footer>
    </div>
  );
}

