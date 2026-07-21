import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import * as availabilityApi from "../api/availability";
import {
  getViewWeekDates,
  formatDateLocal,
  formatTimeLocal,
  formatTimeRange,
  slotToUTC,
  isPastDate,
  isPastDateTime,
} from "../utils/time";

// Show hours 6 AM – 10 PM (UTC indices 6–22) for a cleaner grid
const DISPLAY_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (GMT+0)" },
  { value: "IST", label: "IST (GMT+5:30)" },
];

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatHourShort(utcHourIndex, tz) {
  const iso = new Date(Date.UTC(2000, 0, 1, utcHourIndex, 0)).toISOString();
  return formatTimeLocal(iso, tz);
}

export default function Availability() {
  const { user } = useAuth();
  const isMentor = user?.role === "MENTOR";

  const [displayTimezone, setDisplayTimezone] = useState(user?.timezone || "UTC");
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState({ dates: [], availability: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState({});
  const [error, setError] = useState("");

  const [selectorDate, setSelectorDate] = useState("");
  const [selectorHour, setSelectorHour] = useState(9);

  const fetchWeekly = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const weekDates = getViewWeekDates(weekOffset);
      const res = await availabilityApi.getWeekly({ weekStart: weekDates[0] });
      setData(res);
      setToggles({});
    } catch (e) {
      setError(e.message || "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => { fetchWeekly(); }, [fetchWeekly]);

  const isSlotEnabled = (dateStr, hour) => {
    const key = `${dateStr}-${hour}`;
    if (toggles[key] !== undefined) return toggles[key];
    const slots = data.availability[dateStr] || [];
    const { startTime } = slotToUTC(dateStr, hour);
    return slots.some((s) => s.startTime.slice(0, 13) === startTime.slice(0, 13));
  };

  const isSlotDisabled = (dateStr, hour) => {
    if (isPastDate(dateStr)) return true;
    const utcTodayStr = new Date().toISOString().slice(0, 10);
    if (dateStr === utcTodayStr) {
      const { startTime } = slotToUTC(dateStr, hour);
      return isPastDateTime(startTime);
    }
    return false;
  };

  const toggleSlot = (dateStr, hour) => {
    if (isSlotDisabled(dateStr, hour)) return;
    const key = `${dateStr}-${hour}`;
    setToggles((prev) => ({ ...prev, [key]: !isSlotEnabled(dateStr, hour) }));
  };

  // Count enabled slots for a date
  const countEnabled = (dateStr) =>
    DISPLAY_HOURS.filter((h) => isSlotEnabled(dateStr, h)).length;

  const saveBatch = async () => {
    setSaving(true);
    setError("");
    const slots = [];
    data.dates.forEach((dateStr) => {
      ALL_HOURS.forEach((hour) => {
        const key = `${dateStr}-${hour}`;
        if (toggles[key] === undefined) return;
        const { startTime, endTime } = slotToUTC(dateStr, hour);
        slots.push({ date: dateStr, startTime, endTime, enabled: toggles[key] });
      });
    });
    if (!slots.length) { setSaving(false); return; }
    try {
      await availabilityApi.saveBatch(slots);
      await fetchWeekly();
      setToggles({});
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = Object.keys(toggles).length > 0;
  const gridDates = getViewWeekDates(weekOffset);
  const gridStart = gridDates[0];
  const gridEnd = gridDates[6];

  const weekMin = gridDates[0] || "";
  const weekMax = gridDates[6] || "";
  const isSelectorSlotDisabled = selectorDate !== "" && isSlotDisabled(selectorDate, selectorHour);

  const confirmSelectorSlot = () => {
    if (!selectorDate || isSelectorSlotDisabled) return;
    const key = `${selectorDate}-${selectorHour}`;
    setToggles((prev) => ({ ...prev, [key]: true }));
  };

  const cancelChanges = () => setToggles({});

  // Select an entire day column ON/OFF
  const toggleDay = (dateStr) => {
    const allOn = DISPLAY_HOURS.every((h) => isSlotEnabled(dateStr, h) || isSlotDisabled(dateStr, h));
    const newState = !allOn;
    const updates = {};
    DISPLAY_HOURS.forEach((h) => {
      if (!isSlotDisabled(dateStr, h)) {
        updates[`${dateStr}-${h}`] = newState;
      }
    });
    setToggles((prev) => ({ ...prev, ...updates }));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">
            {isMentor ? "Mentor" : "User"} Availability
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Set your weekly open hours. Mentors will be matched based on these slots.
          </p>
        </div>

        {/* Save / Cancel */}
        <div className="flex items-center gap-2 shrink-0">
          {hasChanges && (
            <button
              type="button"
              onClick={cancelChanges}
              className="text-xs font-bold px-4 py-2 rounded-lg border border-navy-700 text-slate-300 hover:text-white hover:border-navy-600 transition bg-navy-950"
            >
              Discard
            </button>
          )}
          <button
            type="button"
            onClick={saveBatch}
            disabled={saving || !hasChanges}
            className="text-xs font-bold px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-400 text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : `Save Changes${hasChanges ? ` (${Object.keys(toggles).length})` : ""}`}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
          {error}
        </div>
      )}

      {/* Quick Add Slot + Timezone bar */}
      <div className="bg-navy-900 border border-navy-700/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-end gap-4 shadow-xl">
        <div className="flex-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Add Slot</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Date</label>
              <input
                type="date"
                value={selectorDate}
                min={weekMin}
                max={weekMax}
                onChange={(e) => setSelectorDate(e.target.value)}
                className="rounded-lg bg-navy-950 border border-navy-700 text-white text-xs font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1">Time Slot</label>
              <select
                value={selectorHour}
                onChange={(e) => setSelectorHour(Number(e.target.value))}
                className="rounded-lg bg-navy-950 border border-navy-700 text-white text-xs font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[140px]"
              >
                {DISPLAY_HOURS.map((h) => (
                  <option key={h} value={h} disabled={selectorDate ? isSlotDisabled(selectorDate, h) : false}>
                    {formatHourShort(h, displayTimezone)} – {formatHourShort(h + 1, displayTimezone)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={confirmSelectorSlot}
              disabled={!selectorDate || isSelectorSlotDisabled}
              className="text-xs font-bold px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Add Slot
            </button>
          </div>
        </div>

        <div className="shrink-0">
          <label className="block text-[11px] text-slate-500 mb-1">Display Timezone</label>
          <select
            value={displayTimezone}
            onChange={(e) => setDisplayTimezone(e.target.value)}
            className="rounded-lg bg-navy-950 border border-navy-700 text-white text-xs font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Weekly Grid */}
      <div className="bg-navy-900 border border-navy-700/80 rounded-2xl overflow-hidden shadow-xl">
        {/* Week Navigation Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-navy-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setWeekOffset((p) => Math.max(0, p - 1))}
              disabled={weekOffset === 0}
              className="w-7 h-7 rounded-lg border border-navy-700 bg-navy-950 text-slate-400 hover:text-white hover:border-navy-600 transition flex items-center justify-center text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            <div className="text-sm font-bold text-white">
              {formatDateLocal(gridStart, displayTimezone)}
              <span className="text-slate-500 font-normal mx-1">→</span>
              {formatDateLocal(gridEnd, displayTimezone)}
            </div>
            <button
              type="button"
              onClick={() => setWeekOffset((p) => p + 1)}
              className="w-7 h-7 rounded-lg border border-navy-700 bg-navy-950 text-slate-400 hover:text-white hover:border-navy-600 transition flex items-center justify-center text-sm"
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary-500 inline-block" />
              Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-navy-800 border border-navy-700 inline-block" />
              Off
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-navy-950 border border-dashed border-navy-700 opacity-50 inline-block" />
              Past
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500 text-sm animate-pulse">Loading schedule…</div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
            <table className="w-full border-collapse" style={{ minWidth: "600px" }}>
              <colgroup>
                <col style={{ width: "80px" }} />
                {gridDates.map((d) => <col key={d} />)}
              </colgroup>

              <thead className="sticky top-0 z-10 bg-navy-900">
                <tr className="border-b border-navy-800">
                  <th className="py-3 px-2 text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-left">
                    Hour
                  </th>
                  {gridDates.map((d, di) => {
                    const enabled = countEnabled(d);
                    const isToday = d === new Date().toISOString().slice(0, 10);
                    return (
                      <th
                        key={d}
                        className="py-2 px-1 text-center cursor-pointer group"
                        onClick={() => toggleDay(d)}
                        title="Click to toggle entire day"
                      >
                        <div className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${isToday ? "text-primary-400" : "text-slate-400"}`}>
                          {DAY_ABBR[di]}
                        </div>
                        <div className={`text-xs font-bold ${isToday ? "text-white" : "text-slate-300"}`}>
                          {d.slice(8)}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-0.5">
                          {enabled > 0 ? (
                            <span className="text-emerald-400 font-bold">{enabled} open</span>
                          ) : (
                            <span>off</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {DISPLAY_HOURS.map((hour) => (
                  <tr key={hour} className="border-b border-navy-800/60 hover:bg-navy-950/30 transition-colors">
                    <td className="py-1 px-2 text-[10px] text-slate-500 font-mono whitespace-nowrap align-middle">
                      {formatHourShort(hour, displayTimezone)}
                    </td>
                    {gridDates.map((dateStr) => {
                      const enabled = isSlotEnabled(dateStr, hour);
                      const disabled = isSlotDisabled(dateStr, hour);
                      const pending = toggles[`${dateStr}-${hour}`] !== undefined;
                      return (
                        <td key={dateStr} className="p-0.5 align-middle">
                          <button
                            type="button"
                            onClick={() => toggleSlot(dateStr, hour)}
                            disabled={disabled}
                            title={disabled ? "Past slot" : enabled ? "Click to mark unavailable" : "Click to mark available"}
                            className={`
                              w-full h-8 rounded-md border text-[9px] font-bold uppercase tracking-wide transition-all duration-100
                              ${disabled
                                ? "bg-navy-950/50 border-navy-800/50 cursor-not-allowed opacity-30 text-slate-600"
                                : enabled
                                  ? `bg-primary-500/90 border-primary-400/80 text-black hover:bg-primary-400 ${pending ? "ring-1 ring-white/50" : ""}`
                                  : `bg-navy-950 border-navy-800 text-slate-700 hover:border-navy-600 hover:text-slate-500 ${pending ? "ring-1 ring-slate-500/50" : ""}`
                              }
                            `}
                          >
                            {disabled ? "" : enabled ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
