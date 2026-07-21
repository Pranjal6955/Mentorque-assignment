import React, { useState, useRef, useEffect } from "react";
import { Clock, Check } from "lucide-react";

const HOURS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export default function CustomTimePicker({
  hour,
  minute,
  ampm,
  onChange,
  label = "Time",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("hour");
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayTime = `${hour || "10"}:${minute || "00"} ${ampm || "AM"}`;
  const hasValue = hour && minute;

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="block text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary-400" />
          <span>{label}</span>
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full rounded-xl border text-white font-medium px-3.5 py-2.5 text-sm flex items-center justify-between gap-2 transition-all outline-none focus:ring-2 focus:ring-primary-500/50 ${
          hasValue
            ? "bg-navy-950 border-primary-500/40"
            : "bg-navy-950 border-navy-700 hover:border-primary-500/60"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary-500/10 border border-primary-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-3.5 h-3.5 text-primary-400" />
          </div>
          <span className={`truncate text-sm font-mono ${hasValue ? "text-white font-bold" : "text-slate-500"}`}>
            {displayTime}
          </span>
        </div>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto right-0 top-full mt-2 z-50 bg-navy-900 border border-navy-700/90 rounded-2xl shadow-2xl w-80 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Time Display Header */}
          <div className="bg-navy-950 border-b border-navy-800 p-4">
            <div className="flex items-center justify-center gap-1">
              <Clock className="w-5 h-5 text-primary-400 mr-2" />
              <span className="text-3xl font-extrabold text-white font-mono tracking-wider">
                {hour || "10"}
              </span>
              <span className="text-3xl font-extrabold text-primary-400 font-mono">:</span>
              <span className="text-3xl font-extrabold text-white font-mono tracking-wider">
                {minute || "00"}
              </span>
              <div className="ml-3 flex items-center bg-navy-900 rounded-lg border border-navy-700 p-0.5">
                {["AM", "PM"].map((period) => (
                  <button
                    key={period}
                    type="button"
                    onClick={() => onChange({ hour, minute, ampm: period })}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      ampm === period
                        ? "bg-primary-500 text-black shadow-sm"
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex border-b border-navy-800">
            <button
              type="button"
              onClick={() => setActiveTab("hour")}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === "hour"
                  ? "text-primary-400 border-primary-400 bg-primary-500/5"
                  : "text-slate-500 border-transparent hover:text-white"
              }`}
            >
              Hour
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("minute")}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === "minute"
                  ? "text-primary-400 border-primary-400 bg-primary-500/5"
                  : "text-slate-500 border-transparent hover:text-white"
              }`}
            >
              Minute
            </button>
          </div>

          {/* Content Area */}
          <div className="p-3">
            {activeTab === "hour" ? (
              <div className="grid grid-cols-4 gap-1.5">
                {HOURS.map((h) => {
                  const isSelected = hour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onChange({ hour: h, minute, ampm })}
                      className={`h-9 rounded-lg text-sm font-mono font-bold transition-all ${
                        isSelected
                          ? "bg-primary-500 text-black shadow-md shadow-primary-500/20 scale-105"
                          : "bg-navy-950 text-slate-300 hover:bg-navy-800 hover:text-white border border-navy-800"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {MINUTES.map((m) => {
                  const isSelected = minute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onChange({ hour, minute: m, ampm })}
                      className={`h-9 rounded-lg text-sm font-mono font-bold transition-all ${
                        isSelected
                          ? "bg-primary-500 text-black shadow-md shadow-primary-500/20 scale-105"
                          : "bg-navy-950 text-slate-300 hover:bg-navy-800 hover:text-white border border-navy-800"
                      }`}
                    >
                      :{m}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-navy-800 p-3 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-primary-500 text-black hover:bg-primary-400 transition-all"
            >
              Done
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ isOpen }) {
  return (
    <svg
      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
