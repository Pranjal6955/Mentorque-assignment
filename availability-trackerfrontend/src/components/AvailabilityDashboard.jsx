import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import * as availabilityApi from "../api/availability";
import { listMeetings } from "../api/meetings";
import {
  getViewWeekDates,
  formatDateLocal,
  formatTimeLocal,
  formatTimeRange,
  slotToUTC,
  isSlotInPast,
} from "../utils/time";
import MqSelect from "./MqSelect";
import { Calendar, Clock, Sparkles, Video, CheckCircle2, Zap, Trash2, User, ShieldCheck, Eye } from "lucide-react";

function MeetingDetailsModal({ meeting, displayTimezone, onClose }) {
  if (!meeting) return null;

  const isDone = new Date(meeting.endTime || meeting.startTime).getTime() <= Date.now();
  const formattedDate = formatDateLocal(meeting.startTime, displayTimezone);
  const startTimeStr = formatTimeLocal(meeting.startTime, displayTimezone);
  const endTimeStr = formatTimeLocal(meeting.endTime || meeting.startTime, displayTimezone);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/[0.12] bg-navy-900 p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold border ${
                isDone
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-primary-500/10 text-primary-400 border-primary-500/30"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Video className="w-5 h-5 text-primary-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Scheduled Call Details</h3>
                {isDone ? (
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Completed
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                    <Video className="w-3 h-3 text-indigo-400" /> Scheduled
                  </span>
                )}
              </div>
              {meeting.id && (
                <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {meeting.id}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-navy-950 text-slate-400 hover:text-white border border-white/[0.08] flex items-center justify-center font-bold transition-all hover:bg-navy-800"
          >
            ✕
          </button>
        </div>

        {/* Body Details */}
        <div className="space-y-4 text-xs">
          {/* Title */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Call Title
            </label>
            <div className="p-3 bg-navy-950 border border-white/[0.08] rounded-xl font-semibold text-sm text-white">
              {meeting.title || "Mentoring Session"}
            </div>
          </div>

          {/* Call Requirement / Type & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Call Requirement
              </label>
              <div className="p-2.5 bg-navy-950 border border-white/[0.08] rounded-xl font-bold text-xs text-primary-300">
                {meeting.callType ? meeting.callType.replace("_", " ") : "General Mentoring"}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Date ({displayTimezone})
              </label>
              <div className="p-2.5 bg-navy-950 border border-white/[0.08] rounded-xl font-medium text-xs text-white flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-primary-400" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Time Slot */}
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Time Slot ({displayTimezone})
            </label>
            <div className="p-3 bg-navy-950 border border-white/[0.08] rounded-xl font-mono text-xs text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>
                {startTimeStr} – {endTimeStr}
              </span>
            </div>
          </div>

          {/* User / Mentee */}
          {meeting.user && (
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Mentee / User
              </label>
              <div className="p-3 bg-navy-950 border border-white/[0.08] rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs">
                  {meeting.user.name ? meeting.user.name[0].toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-bold text-white text-xs">{meeting.user.name}</p>
                  {meeting.user.email && (
                    <p className="text-[11px] text-slate-400 font-mono">{meeting.user.email}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Mentor */}
          {meeting.mentor && (
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Assigned Mentor
              </label>
              <div className="p-3 bg-navy-950 border border-white/[0.08] rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-400 border border-primary-500/30 flex items-center justify-center font-bold text-xs">
                  {meeting.mentor.name ? meeting.mentor.name[0].toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div>
                  <p className="font-bold text-white text-xs">{meeting.mentor.name}</p>
                  {meeting.mentor.email && (
                    <p className="text-[11px] text-slate-400 font-mono">{meeting.mentor.email}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Participants */}
          {meeting.participants && meeting.participants.length > 0 && (
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Participants ({meeting.participants.length})
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {meeting.participants.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-navy-950 border border-white/[0.08] rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-navy-800 text-slate-300 border border-navy-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {p.name ? p.name[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{p.name || "Participant"}</p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">{p.email}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-white/[0.08] pt-3.5">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-navy-950 hover:bg-navy-800 border border-white/[0.08] rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "GMT (GMT+0)" },
  { value: "IST", label: "IST (GMT+5:30)" },
];

const ROLE_HEADINGS = {
  USER: "User Dashboard",
  MENTOR: "Mentor Dashboard",
};

function SaveScopeModal({ open, saving, onClose, onChoose, forOther = false }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-white/[0.1] bg-navy-900 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-scope-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="save-scope-title" className="text-base font-semibold text-ink-50">
          Apply changes
        </h3>
        <p className="mt-2 text-sm text-ink-500">
          {forOther
            ? "Change just this week, or update their usual weekly schedule."
            : "Like a recurring alarm: change just this week, or update your usual weekly schedule."}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => onChoose("week")}
            className="mq-btn-primary w-full"
          >
            {saving ? "Saving…" : "Just this week"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onChoose("template")}
            className="mq-btn-secondary w-full"
          >
            Every week
          </button>
          <button type="button" disabled={saving} onClick={onClose} className="mq-btn-secondary w-full">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomPresetModal({ open, onClose, onApply }) {

  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4]); // Default Mon-Fri
  const [startHour, setStartHour] = useState(9); // 9 AM
  const [endHour, setEndHour] = useState(17); // 5 PM

  if (!open) return null;

  const DAYS = [
    { idx: 0, name: "Mon" },
    { idx: 1, name: "Tue" },
    { idx: 2, name: "Wed" },
    { idx: 3, name: "Thu" },
    { idx: 4, name: "Fri" },
    { idx: 5, name: "Sat" },
    { idx: 6, name: "Sun" },
  ];

  const toggleDay = (idx) => {
    setSelectedDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]
    );
  };

  const handleApply = () => {
    onApply({ selectedDays, startHour, endHour });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-white/[0.1] bg-navy-900 p-6 shadow-2xl space-y-5"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Configure Custom Preset
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded bg-navy-800"
          >
            ✕
          </button>
        </div>

        {/* Days Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Select Days of Week
          </label>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((day) => {
              const active = selectedDays.includes(day.idx);
              return (
                <button
                  key={day.idx}
                  type="button"
                  onClick={() => toggleDay(day.idx)}
                  className={`py-2 rounded-lg text-xs font-extrabold transition ${
                    active
                      ? "bg-primary-500 text-black shadow-sm"
                      : "bg-navy-800 text-slate-400 hover:bg-navy-700 hover:text-white border border-white/[0.06]"
                  }`}
                >
                  {day.name}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-2 text-[11px]">
            <button
              type="button"
              onClick={() => setSelectedDays([0, 1, 2, 3, 4])}
              className="text-primary-400 hover:underline font-medium"
            >
              Select Weekdays
            </button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={() => setSelectedDays([5, 6])}
              className="text-primary-400 hover:underline font-medium"
            >
              Select Weekends
            </button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
              className="text-primary-400 hover:underline font-medium"
            >
              Select All
            </button>
          </div>
        </div>

        {/* Time Range Pickers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Start Hour
            </label>
            <select
              value={startHour}
              onChange={(e) => setStartHour(Number(e.target.value))}
              className="mq-input font-medium"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h === 0 ? "12:00 AM (00:00)" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              End Hour
            </label>
            <select
              value={endHour}
              onChange={(e) => setEndHour(Number(e.target.value))}
              className="mq-input font-medium"
            >
              {HOURS.map((h) => (
                <option key={h + 1} value={h + 1}>
                  {h + 1 === 24 ? "12:00 AM (Midnight)" : h + 1 < 12 ? `${h + 1}:00 AM` : h + 1 === 12 ? "12:00 PM" : `${h + 1 - 12}:00 PM`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Modal CTAs */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
          <button type="button" onClick={onClose} className="mq-btn-secondary h-9 text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={selectedDays.length === 0 || startHour >= endHour}
            className="mq-btn-primary h-9 text-xs shadow-md"
          >
            Apply Preset
          </button>
        </div>
      </div>
    </div>
  );
}


export default function AvailabilityDashboard({
  role = "USER",
  viewAs = null,
  readOnly: readOnlyProp,
  embedded = false,
}) {
  const { user } = useAuth();
  const readOnly = readOnlyProp ?? false;
  const [displayTimezone, setDisplayTimezone] = useState(
    viewAs?.timezone || user?.timezone || "UTC"
  );
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState({ dates: [], availability: {}, hasTemplate: false });
  const [myMeetings, setMyMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [loading, setLoading] = useState(!user);
  const [saving, setSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [toggles, setToggles] = useState({});

  const [selectedMeetingDetails, setSelectedMeetingDetails] = useState(null);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const dragRef = useRef({ active: false, paintValue: false, visited: new Set() });

  useEffect(() => {
    if (viewAs?.timezone) setDisplayTimezone(viewAs.timezone);
  }, [viewAs?.userId, viewAs?.mentorId, viewAs?.timezone]);

  useEffect(() => {
    const tick = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const endDrag = () => {
      dragRef.current.active = false;
      dragRef.current.visited = new Set();
    };
    window.addEventListener("mouseup", endDrag);
    return () => window.removeEventListener("mouseup", endDrag);
  }, []);

  const fetchWeekly = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const weekDates = getViewWeekDates(weekOffset);
      const params = { weekStart: weekDates[0] };
      if (viewAs?.userId) params.userId = viewAs.userId;
      if (viewAs?.mentorId) params.mentorId = viewAs.mentorId;
      const res = await availabilityApi.getWeekly(params);
      setData(res);
    } catch (e) {
      setError(e.message || "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, [weekOffset, user?.id, viewAs?.userId, viewAs?.mentorId]);

  const fetchMyMeetings = useCallback(async () => {
    if (!user) return;
    setMeetingsLoading(true);
    try {
      const params = {};
      if (viewAs?.userId) params.userId = viewAs.userId;
      if (viewAs?.mentorId) params.mentorId = viewAs.mentorId;
      const meetings = await listMeetings(params);
      setMyMeetings(Array.isArray(meetings) ? meetings : []);
    } catch (e) {
      console.warn("Failed to load meetings:", e.message);
    } finally {
      setMeetingsLoading(false);
    }
  }, [user?.id, viewAs?.userId, viewAs?.mentorId]);

  const getBookedMeetingForSlot = useCallback(
    (dateStr, hour) => {
      if (!myMeetings || myMeetings.length === 0) return null;
      const slot = slotToUTC(dateStr, hour);
      const slotStartMs = new Date(slot.startTime).getTime();
      const slotEndMs = new Date(slot.endTime).getTime();

      return myMeetings.find((m) => {
        const mStartMs = new Date(m.startTime).getTime();
        const mEndMs = new Date(m.endTime || m.startTime).getTime();
        return mStartMs < slotEndMs && mEndMs > slotStartMs;
      });
    },
    [myMeetings]
  );


  useEffect(() => {
    setToggles({});
  }, [weekOffset, viewAs?.userId, viewAs?.mentorId]);

  useEffect(() => {
    if (user) {
      fetchWeekly();
      fetchMyMeetings();
    }
  }, [fetchWeekly, fetchMyMeetings, user]);

  const isSlotEnabled = (dateStr, hour) => {
    const key = `${dateStr}-${hour}`;
    if (toggles[key] !== undefined) return toggles[key];
    const slots = data.availability[dateStr] || [];
    const { startTime } = slotToUTC(dateStr, hour);
    return slots.some((s) => s.startTime.slice(0, 13) === startTime.slice(0, 13));
  };

  const isSlotDisabled = (dateStr, hour) => isSlotInPast(dateStr, hour, nowMs);

  const gridDates = getViewWeekDates(weekOffset);
  const gridStart = gridDates[0];

  // Calculate total enabled hours this week
  const totalAvailableHoursThisWeek = gridDates.reduce((total, dateStr) => {
    return total + HOURS.filter((hour) => !isSlotDisabled(dateStr, hour) && isSlotEnabled(dateStr, hour)).length;
  }, 0);

  const slotKey = (dateStr, hour) => `${dateStr}-${hour}`;

  const startDrag = (dateStr, hour) => {
    if (isSlotDisabled(dateStr, hour)) return;
    const paintValue = !isSlotEnabled(dateStr, hour);
    const key = slotKey(dateStr, hour);
    dragRef.current = { active: true, paintValue, visited: new Set([key]) };
    setToggles((prev) => ({ ...prev, [key]: paintValue }));
  };

  const continueDrag = (dateStr, hour) => {
    const drag = dragRef.current;
    if (!drag.active || isSlotDisabled(dateStr, hour)) return;
    const key = slotKey(dateStr, hour);
    if (drag.visited.has(key)) return;
    drag.visited.add(key);
    setToggles((prev) => ({ ...prev, [key]: drag.paintValue }));
  };

  const toggleColumn = (dateStr) => {
    const actionable = HOURS.filter((h) => !isSlotDisabled(dateStr, h));
    if (actionable.length === 0) return;
    const allOn = actionable.every((h) => isSlotEnabled(dateStr, h));
    const next = !allOn;
    setToggles((prev) => {
      const updated = { ...prev };
      for (const h of actionable) updated[`${dateStr}-${h}`] = next;
      return updated;
    });
  };

  const toggleRow = (hour) => {
    const actionable = gridDates.filter((d) => !isSlotDisabled(d, hour));
    if (actionable.length === 0) return;
    const allOn = actionable.every((d) => isSlotEnabled(d, hour));
    const next = !allOn;
    setToggles((prev) => {
      const updated = { ...prev };
      for (const d of actionable) updated[`${d}-${hour}`] = next;
      return updated;
    });
  };

  // Quick Preset Helper Actions with Edge Case Handling
  const applyStandardWeekdayPreset = () => {
    setToggles((prev) => {
      const updated = { ...prev };
      gridDates.forEach((dateStr, dayIdx) => {
        const isWeekday = dayIdx < 5; // Monday (0) to Friday (4)
        HOURS.forEach((hour) => {
          if (!isSlotDisabled(dateStr, hour)) {
            const shouldEnable = isWeekday && hour >= 9 && hour < 17; // 9 AM - 5 PM
            const key = slotKey(dateStr, hour);
            const currentlyEnabled = isSlotEnabled(dateStr, hour);
            if (shouldEnable !== currentlyEnabled) {
              updated[key] = shouldEnable;
            } else {
              delete updated[key];
            }
          }
        });
      });
      return updated;
    });
  };

  const applyEveningPreset = () => {
    setToggles((prev) => {
      const updated = { ...prev };
      gridDates.forEach((dateStr) => {
        HOURS.forEach((hour) => {
          if (!isSlotDisabled(dateStr, hour)) {
            const shouldEnable = hour >= 17 && hour < 21; // 5 PM - 9 PM
            const key = slotKey(dateStr, hour);
            const currentlyEnabled = isSlotEnabled(dateStr, hour);
            if (shouldEnable !== currentlyEnabled) {
              updated[key] = shouldEnable;
            } else {
              delete updated[key];
            }
          }
        });
      });
      return updated;
    });
  };

  const clearAllWeekSlots = () => {
    setToggles((prev) => {
      const updated = { ...prev };
      gridDates.forEach((dateStr) => {
        HOURS.forEach((hour) => {
          if (!isSlotDisabled(dateStr, hour)) {
            const key = slotKey(dateStr, hour);
            const currentlyEnabled = isSlotEnabled(dateStr, hour);
            if (currentlyEnabled) {
              updated[key] = false;
            } else {
              delete updated[key];
            }
          }
        });
      });
      return updated;
    });
  };

  const applyCustomPreset = ({ selectedDays, startHour, endHour }) => {

    setToggles((prev) => {
      const updated = { ...prev };
      gridDates.forEach((dateStr, dayIdx) => {
        const isSelectedDay = selectedDays.includes(dayIdx);
        HOURS.forEach((hour) => {
          if (!isSlotDisabled(dateStr, hour)) {
            const shouldEnable = isSelectedDay && hour >= startHour && hour < endHour;
            const key = slotKey(dateStr, hour);
            const currentlyEnabled = isSlotEnabled(dateStr, hour);
            if (shouldEnable !== currentlyEnabled) {
              updated[key] = shouldEnable;
            } else {
              delete updated[key];
            }
          }
        });
      });
      return updated;
    });
  };



  const isColumnAllEnabled = (dateStr) => {
    const actionable = HOURS.filter((h) => !isSlotDisabled(dateStr, h));
    return actionable.length > 0 && actionable.every((h) => isSlotEnabled(dateStr, h));
  };

  const isRowAllEnabled = (hour) => {
    const actionable = gridDates.filter((d) => !isSlotDisabled(d, hour));
    return actionable.length > 0 && actionable.every((d) => isSlotEnabled(d, hour));
  };


  const hasActionableColumn = (dateStr) => HOURS.some((h) => !isSlotDisabled(dateStr, h));
  const hasActionableRow = (hour) => gridDates.some((d) => !isSlotDisabled(d, hour));

  const buildWeekChanges = () =>
    Object.entries(toggles).map(([key, enabled]) => {
      const sep = key.lastIndexOf("-");
      const dateStr = key.slice(0, sep);
      const hour = Number(key.slice(sep + 1));
      const dayOfWeek = gridDates.indexOf(dateStr);
      return { dayOfWeek, hour, enabled };
    });

  const buildFullPattern = () => {
    const pattern = [];
    gridDates.forEach((dateStr, dayOfWeek) => {
      HOURS.forEach((hour) => {
        if (isSlotDisabled(dateStr, hour)) return;
        if (isSlotEnabled(dateStr, hour)) {
          pattern.push({ dayOfWeek, hour });
        }
      });
    });
    return pattern;
  };

  const commitSave = async (scope) => {
    setSaving(true);
    setError("");
    try {
      const body =
        scope === "template"
          ? { weekStart: gridStart, scope: "template", pattern: buildFullPattern() }
          : { weekStart: gridStart, scope: "week", slots: buildWeekChanges() };
      if (viewAs?.userId) body.userId = viewAs.userId;
      if (viewAs?.mentorId) body.mentorId = viewAs.mentorId;

      const res = await availabilityApi.saveBatch(body);
      setData(res);
      setToggles({});
      setSaveModalOpen(false);
    } catch (e) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (!data.hasTemplate) {
      commitSave("template");
      return;
    }
    setSaveModalOpen(true);
  };

  const hasChanges = Object.keys(toggles).length > 0;

  const prevWeek = () => {
    if (!readOnly && weekOffset === 0) return;
    setWeekOffset((prev) => prev - 1);
  };
  const nextWeek = () => setWeekOffset((prev) => prev + 1);

  const cancelChanges = () => setToggles({});

  const formatTimeOptionLabel = (utcHourIndex) => {
    const startISO = new Date(Date.UTC(2000, 0, 1, utcHourIndex, 0)).toISOString();
    const endISO = new Date(Date.UTC(2000, 0, 1, utcHourIndex + 1, 0)).toISOString();
    const start = formatTimeLocal(startISO, displayTimezone);
    const end = formatTimeLocal(endISO, displayTimezone);
    return formatTimeRange(`${start} – ${end}`);
  };

  const heading = viewAs
    ? `${viewAs.name}'s availability`
    : (ROLE_HEADINGS[role] ?? ROLE_HEADINGS.USER);
  const subtitle = viewAs
    ? readOnly
      ? `View-only${viewAs.email ? ` · ${viewAs.email}` : ""} · ${viewAs.role === "MENTOR" ? "Mentor" : "User"}`
      : `Edit on their behalf${viewAs.email ? ` · ${viewAs.email}` : ""} · ${viewAs.role === "MENTOR" ? "Mentor" : "User"}`
    : "Your usual weekly schedule applies every week. Change a slot to adjust this week or all weeks.";

  return (
    <div className={embedded ? "space-y-5" : "mx-auto w-full max-w-[1600px] space-y-5"}>
      {!readOnly && (
        <>
          <SaveScopeModal
            open={saveModalOpen}
            saving={saving}
            onClose={() => !saving && setSaveModalOpen(false)}
            onChoose={commitSave}
            forOther={Boolean(viewAs)}
          />
          <CustomPresetModal
            open={customModalOpen}
            onClose={() => setCustomModalOpen(false)}
            onApply={applyCustomPreset}
          />
        </>
      )}


      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {!embedded && (
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink-50">{heading}</h1>
            <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>
          </div>
        )}
        {embedded && viewAs && (
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink-50">{heading}</h2>
            <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>
          </div>
        )}
        <MqSelect
          id="display-timezone"
          label="Timezone"
          value={displayTimezone}
          onChange={setDisplayTimezone}
          options={TIMEZONE_OPTIONS}
          className={`relative w-full min-w-0 sm:w-44 sm:shrink-0 ${embedded ? "sm:ml-auto" : ""}`}
          labelClassName="text-right"
          menuAlign="right"
        />
      </header>

      {/* KPI Stats Header Summary */}
      {!embedded && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="mq-card p-4 flex items-center gap-4">
            <div className="rounded-lg bg-primary-500/10 p-3 text-primary-400">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500">Available This Week</p>
              <h3 className="text-xl font-bold text-ink-50 mt-0.5">{totalAvailableHoursThisWeek} Hours</h3>
            </div>
          </div>

          <div className="mq-card p-4 flex items-center gap-4">
            <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-400">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500">Scheduled Calls</p>
              <h3 className="text-xl font-bold text-ink-50 mt-0.5">{myMeetings.length} Sessions</h3>
            </div>
          </div>

          <div className="mq-card p-4 flex items-center gap-4">
            <div className="rounded-lg bg-indigo-500/10 p-3 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-ink-500">Role & Timezone</p>
              <h3 className="text-sm font-semibold text-ink-50 mt-0.5">{role} ({displayTimezone})</h3>
            </div>
          </div>
        </div>
      )}

      <MeetingDetailsModal
        meeting={selectedMeetingDetails}
        displayTimezone={displayTimezone}
        onClose={() => setSelectedMeetingDetails(null)}
      />

      {/* Booked Meetings Section */}
      {!embedded && myMeetings.length > 0 && (
        <section className="mq-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary-400" />
            <h2 className="text-base font-semibold text-ink-50">Scheduled Calls</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {myMeetings.map((m) => {
              const endTimeMs = new Date(m.endTime || m.startTime).getTime();
              const isDone = endTimeMs <= nowMs;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMeetingDetails(m)}
                  className={`group relative rounded-lg border p-4 transition cursor-pointer hover:shadow-lg hover:scale-[1.01] ${
                    isDone
                      ? "border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-400"
                      : "border-white/[0.08] bg-navy-800 hover:border-primary-500/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-ink-50 text-sm line-clamp-1 group-hover:text-primary-300 transition-colors">
                      {m.title}
                    </h4>
                    {isDone ? (
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Completed
                      </span>
                    ) : m.callType ? (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300 shrink-0">
                        {m.callType.replace("_", " ")}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 shrink-0">
                        Scheduled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-400 mt-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-ink-500" />
                    {formatDateLocal(m.startTime, displayTimezone)} ({formatTimeLocal(m.startTime, displayTimezone)})
                  </p>
                  <div className="mt-3 pt-3 border-t border-white/[0.04] text-xs text-ink-400 space-y-1 flex items-center justify-between">
                    <div>
                      {m.user && <p><span className="text-ink-600">User:</span> {m.user.name}</p>}
                      {m.mentor && <p><span className="text-ink-600">Mentor:</span> {m.mentor.name}</p>}
                    </div>
                    <span className="text-[11px] font-bold text-primary-400 group-hover:underline flex items-center gap-1 shrink-0">
                      <Eye className="w-3.5 h-3.5" /> Details
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}



      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      <section className="mq-card overflow-hidden border border-white/[0.08] bg-navy-900 shadow-xl rounded-xl">
        {/* Cal.com Style Header Controls Bar */}
        <div className="flex flex-col gap-4 border-b border-white/[0.08] bg-navy-950/60 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-400" />
              Weekly Schedule Editor
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {readOnly
                ? "Inspect scheduled availability for the selected week."
                : "Click or drag across slots to mark availability. Changes apply recurringly."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Week Navigator */}
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-navy-800 p-1 text-xs font-semibold text-white">
              <button
                type="button"
                onClick={prevWeek}
                disabled={!readOnly && weekOffset === 0}
                className="rounded-md p-1.5 hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                aria-label="Previous week"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="px-2 font-medium text-slate-200">
                {formatDateLocal(gridStart, displayTimezone)} – {formatDateLocal(gridDates[6], displayTimezone)}
              </span>
              <button
                type="button"
                onClick={nextWeek}
                className="rounded-md p-1.5 hover:bg-navy-700 transition"
                aria-label="Next week"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {weekOffset !== 0 && (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="ml-1 rounded px-2 py-0.5 bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 text-[11px] font-bold uppercase transition"
                >
                  Today
                </button>
              )}
            </div>

            {/* Save / Cancel CTAs */}
            {!readOnly && (
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <span className="text-xs text-amber-400 font-medium hidden sm:inline">
                    ● {Object.keys(toggles).length} unsaved changes
                  </span>
                )}
                <button type="button" onClick={cancelChanges} disabled={!hasChanges} className="mq-btn-secondary h-9 text-xs">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={saving || !hasChanges}
                  className="mq-btn-primary h-9 text-xs shadow-md"
                >
                  {saving ? "Saving…" : "Save Schedule"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cal.com Quick Presets Toolbar */}
        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-navy-950/40 px-5 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5 mr-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Quick Presets:
              </span>

              <button
                type="button"
                onClick={applyStandardWeekdayPreset}
                className="px-3 py-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-white font-medium border border-white/[0.08] hover:border-primary-500/40 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>⚡</span> Working Hours (Mon–Fri, 9am–5pm)
              </button>
              <button
                type="button"
                onClick={applyEveningPreset}
                className="px-3 py-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-white font-medium border border-white/[0.08] hover:border-indigo-500/40 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>🌙</span> Evening Shift (5pm–9pm)
              </button>
              <button
                type="button"
                onClick={() => setCustomModalOpen(true)}
                className="px-3 py-1.5 rounded-md bg-navy-800 hover:bg-navy-700 text-white font-medium border border-white/[0.08] hover:border-amber-500/40 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>⚙️</span> Custom Preset…
              </button>
              <button
                type="button"
                onClick={clearAllWeekSlots}
                className="px-3 py-1.5 rounded-md bg-navy-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 font-medium border border-white/[0.08] hover:border-red-500/40 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>🧹</span> Clear Schedule
              </button>

            </div>
          </div>
        )}

        <div className="mq-scroll max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="p-16 text-center text-sm text-slate-400">Loading schedule grid…</div>
          ) : (
            <table className="w-full table-fixed border-collapse select-none">
              <colgroup>
                <col style={{ width: "10rem" }} />
                {gridDates.map((d) => (
                  <col key={d} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-navy-950 border-b border-white/[0.08]">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    Time (UTC)
                  </th>
                  {gridDates.map((d) => {
                    const colActive = isColumnAllEnabled(d);
                    const colActionable = hasActionableColumn(d);
                    const dateObj = new Date(d);
                    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
                    const dayNum = dateObj.getDate();

                    return (
                      <th key={d} className="px-1 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => !readOnly && toggleColumn(d)}
                          disabled={readOnly || !colActionable}
                          title={!readOnly && colActionable ? "Toggle all slots this day" : undefined}
                          className={`
                            w-full rounded-lg px-2 py-2 text-xs font-bold transition flex flex-col items-center justify-center gap-0.5
                            ${!colActionable
                              ? "cursor-not-allowed text-slate-600"
                              : "cursor-pointer hover:bg-navy-800"}
                            ${colActionable && colActive ? "text-primary-400 bg-navy-800/80" : "text-slate-200"}
                          `}
                        >
                          <span className="text-[10px] tracking-wider font-extrabold text-slate-400">{dayName}</span>
                          <span className={`text-sm font-black px-2 py-0.5 rounded-full ${colActive ? "bg-primary-500 text-black" : "bg-navy-900 text-white"}`}>
                            {dayNum}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] bg-navy-950/20">
                {HOURS.map((hour) => {
                  const rowActive = isRowAllEnabled(hour);
                  const rowActionable = hasActionableRow(hour);
                  return (
                    <tr key={hour} className="hover:bg-white/[0.01] transition-colors">
                      <td className="px-2 py-1.5 align-middle">
                        <button
                          type="button"
                          onClick={() => !readOnly && toggleRow(hour)}
                          disabled={readOnly || !rowActionable}
                          title={!readOnly && rowActionable ? "Toggle all slots this hour" : undefined}
                          className={`
                            w-full rounded-md px-2.5 py-1.5 text-left text-xs font-mono font-medium whitespace-nowrap transition
                            ${!rowActionable
                              ? "cursor-not-allowed text-slate-600"
                              : "cursor-pointer hover:bg-navy-800"}
                            ${rowActionable && rowActive ? "text-primary-300 font-bold bg-navy-800/60" : "text-slate-400"}
                          `}
                        >
                          {formatTimeOptionLabel(hour)}
                        </button>
                      </td>
                      {gridDates.map((dateStr) => {
                        const enabled = isSlotEnabled(dateStr, hour);
                        const disabled = isSlotDisabled(dateStr, hour);
                        const bookedMeeting = getBookedMeetingForSlot(dateStr, hour);
                        const isMeetingDone =
                          bookedMeeting &&
                          new Date(bookedMeeting.endTime || bookedMeeting.startTime).getTime() <= nowMs;

                        if (bookedMeeting) {
                          return (
                            <td key={dateStr} className="p-1 align-middle">
                              <button
                                type="button"
                                onClick={() => setSelectedMeetingDetails(bookedMeeting)}
                                title={`Click to view meeting details: ${bookedMeeting.title}${bookedMeeting.user ? ` (User: ${bookedMeeting.user.name})` : ""}${bookedMeeting.mentor ? ` (Mentor: ${bookedMeeting.mentor.name})` : ""}`}
                                className={`relative flex items-center justify-center w-full h-8 rounded-md text-[11px] font-extrabold shadow-md transition-all border cursor-pointer hover:scale-[1.04] active:scale-95 ${
                                  isMeetingDone
                                    ? "bg-emerald-500 text-black border-emerald-400 ring-2 ring-emerald-500/40 hover:bg-emerald-400 hover:shadow-emerald-500/20"
                                    : "bg-indigo-600 text-white border-indigo-400 ring-2 ring-indigo-500/50 hover:bg-indigo-500 hover:shadow-indigo-500/30"
                                }`}
                              >
                                <span className="flex items-center gap-1 truncate px-1">
                                  {isMeetingDone ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-black shrink-0" />
                                      <span className="truncate">Done</span>
                                    </>
                                  ) : (
                                    <>
                                      <Video className="w-3 h-3 text-white shrink-0" />
                                      <span className="truncate">Booked</span>
                                    </>
                                  )}
                                </span>
                              </button>
                            </td>
                          );
                        }

                        return (
                          <td key={dateStr} className="p-1 align-middle">
                            <button
                              type="button"
                              onMouseDown={
                                readOnly
                                  ? undefined
                                  : (e) => {
                                      e.preventDefault();
                                      startDrag(dateStr, hour);
                                    }
                              }
                              onMouseEnter={readOnly ? undefined : () => continueDrag(dateStr, hour)}
                              disabled={disabled || readOnly}
                              aria-label={
                                disabled
                                  ? "Past slot"
                                  : enabled
                                    ? readOnly
                                      ? "Available"
                                      : "Available, click to remove"
                                    : readOnly
                                      ? "Unavailable"
                                      : "Unavailable, click to mark available"
                              }
                              className={`
                                relative flex items-center justify-center w-full h-8 rounded-md text-xs font-semibold transition-all duration-150
                                ${!disabled && !readOnly ? "cursor-pointer active:scale-95" : ""}
                                ${disabled ? "bg-navy-950 opacity-20 border border-transparent cursor-not-allowed" : ""}
                                ${readOnly && !disabled ? "cursor-default" : ""}
                                ${!disabled && enabled ? "bg-primary-500 text-black font-bold border border-primary-400 shadow-sm" : ""}
                                ${!disabled && !enabled ? "bg-navy-900 border border-white/[0.05] hover:bg-navy-800 hover:border-white/20 text-slate-500" : ""}
                              `}
                            >
                              {!disabled && enabled && (
                                <span className="flex items-center justify-center" aria-hidden>
                                  <svg
                                    className="h-3 w-3 text-black stroke-[3]"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M2.5 6l2.5 2.5 4.5-5" />
                                  </svg>
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}


