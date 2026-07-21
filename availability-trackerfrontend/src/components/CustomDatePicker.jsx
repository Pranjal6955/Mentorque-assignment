import React, { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

export default function CustomDatePicker({ value, onChange, label = "Date" }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial date or default to today
  const initialDate = value ? new Date(value + "T00:00:00") : new Date();
  const [currentViewDate, setCurrentViewDate] = useState(initialDate);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth(); // 0-indexed

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Helper to generate calendar matrix
  const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfWeek = (y, m) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  // Generate matrix array
  const calendarCells = [];
  // Previous month padding
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, currentMonth: false, isPrev: true });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({ day: d, currentMonth: true });
  }
  // Next month padding to complete 35 or 42 cells
  const totalCells = calendarCells.length > 35 ? 42 : 35;
  const nextMonthPadding = totalCells - calendarCells.length;
  for (let n = 1; n <= nextMonthPadding; n++) {
    calendarCells.push({ day: n, currentMonth: false, isNext: true });
  }

  const handlePrevMonth = () => {
    setCurrentViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (dayObj) => {
    if (!dayObj.currentMonth) return;
    const mStr = String(month + 1).padStart(2, "0");
    const dStr = String(dayObj.day).padStart(2, "0");
    const selectedIso = `${year}-${mStr}-${dStr}`;
    onChange(selectedIso);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const mStr = String(today.getMonth() + 1).padStart(2, "0");
    const dStr = String(today.getDate()).padStart(2, "0");
    const selectedIso = `${y}-${mStr}-${dStr}`;
    setCurrentViewDate(today);
    onChange(selectedIso);
    setIsOpen(false);
  };

  // Formatted date string for button display
  const displayFormattedDate = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Select Date";

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-primary-400" />
          <span>{label}</span>
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl bg-navy-950 border border-navy-700 hover:border-primary-500/60 text-white font-medium px-3.5 py-2 text-sm flex items-center justify-between gap-2 transition-all outline-none focus:ring-2 focus:ring-primary-500/50"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon className="w-4 h-4 text-primary-400 shrink-0" />
          <span className="truncate text-xs font-semibold text-white">
            {displayFormattedDate}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-bold bg-navy-900 border border-navy-800 px-2 py-0.5 rounded-md flex items-center gap-1">
          <CalendarIcon className="w-3 h-3 text-primary-400" />
          <span>Choose</span>
        </span>
      </button>

      {/* CUSTOM CALENDAR POPOVER */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 bg-navy-900 border border-navy-700/90 rounded-2xl p-4 shadow-2xl w-72 animate-in fade-in zoom-in-95 duration-150">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-3 border-b border-navy-800 pb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-lg bg-navy-950 hover:bg-navy-800 text-slate-300 border border-navy-800 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white tracking-wide">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-7 h-7 rounded-lg bg-navy-950 hover:bg-navy-800 text-slate-300 border border-navy-800 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {dayNames.map((d) => (
              <span key={d} className="text-[10px] font-bold text-slate-400 py-1 uppercase">
                {d}
              </span>
            ))}
          </div>

          {/* Days Matrix */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((cell, idx) => {
              const mStr = String(month + 1).padStart(2, "0");
              const dStr = String(cell.day).padStart(2, "0");
              const cellIso = `${year}-${mStr}-${dStr}`;
              const isSelected = value === cellIso && cell.currentMonth;

              const today = new Date();
              const isToday =
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === cell.day &&
                cell.currentMonth;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!cell.currentMonth}
                  onClick={() => handleSelectDay(cell)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium flex items-center justify-center transition-all ${
                    !cell.currentMonth
                      ? "text-slate-600 cursor-not-allowed opacity-30"
                      : isSelected
                      ? "bg-primary-500 text-black font-extrabold shadow-md shadow-primary-500/20 scale-105 ring-2 ring-primary-400"
                      : isToday
                      ? "bg-navy-950 text-primary-400 border border-primary-500/50 font-bold"
                      : "text-slate-300 hover:bg-navy-800 hover:text-white"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Calendar Quick Actions */}
          <div className="flex items-center justify-between border-t border-navy-800 mt-3 pt-2">
            <button
              type="button"
              onClick={handleToday}
              className="text-[11px] font-bold text-primary-400 hover:text-primary-300 transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-medium text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
