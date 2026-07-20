import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { DateTime } from "luxon";
import { useAuth } from "../context/AuthContext";
import * as adminApi from "../api/admin";
import * as availabilityApi from "../api/availability";
import * as meetingsApi from "../api/meetings";
import {
  formatDateLocal,
  formatSlotLabel,
  formatTimeRange,
  isPastDateTime,
} from "../utils/time";
import AddUserModal from "../components/AddUserModal";
import AddMentorModal from "../components/AddMentorModal";

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "GMT (GMT+0)" },
  { value: "IST", label: "IST (GMT+5:30)" },
];

const SCHEDULE_HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const SCHEDULE_MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const SCHEDULE_AMPM_OPTIONS = ["AM", "PM"];

const scheduleTimeSelectClass =
  "min-w-0 flex-1 box-border rounded-lg bg-slate-950 border border-slate-800 text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none";

export default function AdminDashboard() {
  const { user: authUser } = useAuth();
  const [adminEmail, setAdminEmail] = useState("");
  const [users, setUsers] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [displayTimezone, setDisplayTimezone] = useState("UTC");
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    return base.toISOString().slice(0, 10);
  });
  const emptyAvailability = useMemo(() => ({ dates: [], availability: {} }), []);
  const [userAvailability, setUserAvailability] = useState(() => ({ dates: [], availability: {} }));
  const [mentorAvailability, setMentorAvailability] = useState(() => ({ dates: [], availability: {} }));
  const [loadingUserAvail, setLoadingUserAvail] = useState(false);
  const [loadingMentorAvail, setLoadingMentorAvail] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleStartHour, setScheduleStartHour] = useState("");
  const [scheduleStartMinute, setScheduleStartMinute] = useState("");
  const [scheduleStartAmPm, setScheduleStartAmPm] = useState("");
  const [scheduleEndHour, setScheduleEndHour] = useState("");
  const [scheduleEndMinute, setScheduleEndMinute] = useState("");
  const [scheduleEndAmPm, setScheduleEndAmPm] = useState("");
  const [scheduleInlineError, setScheduleInlineError] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [mentorEmail, setMentorEmail] = useState("");
  const [additionalEmails, setAdditionalEmails] = useState([""]);
  const [overlapSlots, setOverlapSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddMentorModal, setShowAddMentorModal] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState(null);
  const [deletingMeetingId, setDeletingMeetingId] = useState(null);
  const [activeMeeting, setActiveMeeting] = useState(null);
  const [copiedMeetingDetails, setCopiedMeetingDetails] = useState(false);
  const meetingsRef = useRef([]);
  const [selectedCommonSlot, setSelectedCommonSlot] = useState(null);
  const prevDisplayTimezoneRef = useRef(displayTimezone);

  const loadUsers = useCallback(async () => {
    try {
      const [u, m] = await Promise.all([adminApi.listUsers(), adminApi.listMentors()]);
      setUsers(u);
      setMentors(m);
    } catch (e) {
      setError(e.message || "Failed to load users");
    }
  }, []);

  const availabilityTarget = selectedUser || selectedMentor;

  const loadUserAvailability = useCallback(async () => {
    if (!selectedUser) {
      setUserAvailability(emptyAvailability);
      return;
    }
    setLoadingUserAvail(true);
    setError("");
    try {
      const data = await availabilityApi.getWeekly({ userId: selectedUser.id, weekStart });
      setUserAvailability(data);
    } catch (e) {
      setError(e.message || "Failed to load user availability");
      setUserAvailability(emptyAvailability);
    } finally {
      setLoadingUserAvail(false);
    }
  }, [selectedUser, weekStart, emptyAvailability]);

  const loadMentorAvailability = useCallback(async () => {
    if (!selectedMentor) {
      setMentorAvailability(emptyAvailability);
      return;
    }
    setLoadingMentorAvail(true);
    setError("");
    try {
      const data = await availabilityApi.getWeekly({ mentorId: selectedMentor.id, weekStart });
      setMentorAvailability(data);
    } catch (e) {
      setError(e.message || "Failed to load mentor availability");
      setMentorAvailability(emptyAvailability);
    } finally {
      setLoadingMentorAvail(false);
    }
  }, [selectedMentor, weekStart, emptyAvailability]);

  const loadMeetings = useCallback(async () => {
    try {
      const list = await meetingsApi.listMeetings();
      setMeetings(list);
    } catch {
      setMeetings([]);
    }
  }, []);

  useEffect(() => {
    meetingsRef.current = meetings;
  }, [meetings]);

  // Initialize admin email from localStorage (SSO) or auth user on mount
  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail");
    if (storedEmail) {
      setAdminEmail(storedEmail);
    } else if (authUser?.email) {
      setAdminEmail(authUser.email);
    }
  }, [authUser?.email]);

  useEffect(() => {
    loadUsers();
    loadMeetings();
  }, [loadUsers, loadMeetings]);

  useEffect(() => {
    if (!selectedUser) {
      setUserAvailability(emptyAvailability);
    }
  }, [selectedUser, emptyAvailability]);
  useEffect(() => {
    if (!selectedMentor) {
      setMentorAvailability(emptyAvailability);
    }
  }, [selectedMentor, emptyAvailability]);

  useEffect(() => {
    loadUserAvailability();
  }, [loadUserAvailability]);
  useEffect(() => {
    loadMentorAvailability();
  }, [loadMentorAvailability]);

  useEffect(() => {
    if (selectedUser) setUserEmail(selectedUser.email);
  }, [selectedUser]);
  useEffect(() => {
    if (selectedMentor) setMentorEmail(selectedMentor.email);
  }, [selectedMentor]);

  const to24From12 = useCallback((hourStr, minuteStr, amPm) => {
    if (!hourStr || !minuteStr || !amPm) return null;
    let h = parseInt(hourStr, 10);
    if (Number.isNaN(h)) return null;
    const ap = amPm.toUpperCase();
    if (ap === "AM") {
      if (h === 12) h = 0;
    } else if (ap === "PM") {
      if (h !== 12) h += 12;
    } else return null;
    return `${String(h).padStart(2, "0")}:${minuteStr}`;
  }, []);

  const hm24To12Parts = useCallback((hm24) => {
    if (!hm24 || !/^\d{1,2}:\d{2}$/.test(hm24)) return { hour: "", minute: "", amPm: "" };
    const [hs, ms] = hm24.split(":");
    let h = parseInt(hs, 10);
    const minute = ms.padStart(2, "0");
    if (Number.isNaN(h)) return { hour: "", minute: "", amPm: "" };
    let amPm = "AM";
    if (h === 0) {
      h = 12;
    } else if (h === 12) {
      amPm = "PM";
    } else if (h > 12) {
      h -= 12;
      amPm = "PM";
    }
    return { hour: String(h), minute, amPm };
  }, []);

  const meetingZone = displayTimezone === "IST" ? "Asia/Kolkata" : "Europe/Dublin";

  const scheduleStartDt = useMemo(() => {
    const hm = to24From12(scheduleStartHour, scheduleStartMinute, scheduleStartAmPm);
    if (!scheduleDate || !hm) return null;
    const dt = DateTime.fromFormat(`${scheduleDate} ${hm}`, "yyyy-MM-dd HH:mm", { zone: meetingZone });
    return dt.isValid ? dt : null;
  }, [scheduleDate, scheduleStartHour, scheduleStartMinute, scheduleStartAmPm, meetingZone, to24From12]);

  const scheduleEndDt = useMemo(() => {
    const hm = to24From12(scheduleEndHour, scheduleEndMinute, scheduleEndAmPm);
    if (!scheduleDate || !hm) return null;
    const dt = DateTime.fromFormat(`${scheduleDate} ${hm}`, "yyyy-MM-dd HH:mm", { zone: meetingZone });
    return dt.isValid ? dt : null;
  }, [scheduleDate, scheduleEndHour, scheduleEndMinute, scheduleEndAmPm, meetingZone, to24From12]);

  const scheduleStartIso = scheduleStartDt?.toISO() ?? "";
  const scheduleEndIso = scheduleEndDt?.toISO() ?? "";

  const checkOverlap = useCallback(async () => {
    if (!availabilityTarget || !scheduleStartIso || !scheduleEndIso) return;
    try {
      const slots = await adminApi.getOverlappingSlots(
        availabilityTarget.id,
        scheduleStartIso,
        scheduleEndIso
      );
      setOverlapSlots(slots);
    } catch {
      setOverlapSlots([]);
    }
  }, [availabilityTarget, scheduleStartIso, scheduleEndIso]);

  useEffect(() => {
    if (scheduleStartIso && scheduleEndIso && availabilityTarget?.id) checkOverlap();
    else setOverlapSlots([]);
  }, [scheduleStartIso, scheduleEndIso, availabilityTarget?.id, checkOverlap]);

  const getParticipantEmails = () => {
    const list = [userEmail.trim(), mentorEmail.trim(), ...additionalEmails.map((e) => e.trim())].filter(Boolean);
    return list;
  };

  const handleScheduleMeeting = async (e) => {
    e.preventDefault();
    setScheduleInlineError("");
    setSuccess("");
    if (!scheduleTitle.trim()) {
      setScheduleInlineError("Meeting name is required.");
      return;
    }
    if (!scheduleDate) {
      setScheduleInlineError("Please select a date.");
      return;
    }
    if (!scheduleStartHour || !scheduleStartMinute || !scheduleStartAmPm) {
      setScheduleInlineError("Please select a complete start time");
      return;
    }
    if (!scheduleEndHour || !scheduleEndMinute || !scheduleEndAmPm) {
      setScheduleInlineError("Please select a complete end time");
      return;
    }
    if (!scheduleStartDt || !scheduleEndDt) {
      setScheduleInlineError("Invalid date or time.");
      return;
    }
    if (scheduleEndDt.toMillis() <= scheduleStartDt.toMillis()) {
      setScheduleInlineError("End time must be after start time");
      return;
    }
    if (isPastDateTime(scheduleStartIso)) {
      setScheduleInlineError("Cannot schedule in the past.");
      return;
    }
    setLoading(true);
    try {
      const date = scheduleStartDt.toFormat("dd-MM-yyyy");
      const startTime = scheduleStartDt.toFormat("HH:mm");
      const endTime = scheduleEndDt.toFormat("HH:mm");
      const timezone = displayTimezone === "IST" ? "Asia/Kolkata" : "Europe/Dublin";
      await adminApi.scheduleMeeting({
        title: scheduleTitle.trim(),
        date,
        startTime,
        endTime,
        timezone,
        participantEmails: getParticipantEmails(),
      });
      setSuccess("Meeting scheduled. Meet link will appear if Google is connected.");
      setScheduleTitle("");
      setScheduleStartHour("");
      setScheduleStartMinute("");
      setScheduleStartAmPm("");
      setScheduleEndHour("");
      setScheduleEndMinute("");
      setScheduleEndAmPm("");
      setScheduleInlineError("");
      setUserEmail("");
      setMentorEmail("");
      setAdditionalEmails([""]);
      setOverlapSlots([]);
      loadMeetings();
    } catch (err) {
      setScheduleInlineError(err.message || "Failed to schedule meeting");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 2000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    const prevTz = prevDisplayTimezoneRef.current;
    if (prevTz === displayTimezone) return;

    const prevZone = prevTz === "IST" ? "Asia/Kolkata" : "Europe/Dublin";
    const newZone = displayTimezone === "IST" ? "Asia/Kolkata" : "Europe/Dublin";

    const convertParts = (hour, minute, amPm) => {
      const hm = to24From12(hour, minute, amPm);
      if (!scheduleDate || !hm) return null;
      const dtPrev = DateTime.fromFormat(`${scheduleDate} ${hm}`, "yyyy-MM-dd HH:mm", { zone: prevZone });
      if (!dtPrev.isValid) return null;
      const dtNew = dtPrev.setZone(newZone);
      return {
        date: dtNew.toFormat("yyyy-MM-dd"),
        hm: dtNew.toFormat("HH:mm"),
      };
    };

    const sConv = convertParts(scheduleStartHour, scheduleStartMinute, scheduleStartAmPm);
    const eConv = convertParts(scheduleEndHour, scheduleEndMinute, scheduleEndAmPm);

    if (!sConv && !eConv) {
      prevDisplayTimezoneRef.current = displayTimezone;
      return;
    }

    if (sConv) {
      setScheduleDate(sConv.date);
      const p = hm24To12Parts(sConv.hm);
      setScheduleStartHour(p.hour);
      setScheduleStartMinute(p.minute);
      setScheduleStartAmPm(p.amPm);
    }
    if (eConv) {
      const p = hm24To12Parts(eConv.hm);
      setScheduleEndHour(p.hour);
      setScheduleEndMinute(p.minute);
      setScheduleEndAmPm(p.amPm);
    }

    prevDisplayTimezoneRef.current = displayTimezone;
  }, [
    displayTimezone,
    scheduleDate,
    scheduleStartHour,
    scheduleStartMinute,
    scheduleStartAmPm,
    scheduleEndHour,
    scheduleEndMinute,
    scheduleEndAmPm,
    to24From12,
    hm24To12Parts,
  ]);

  useEffect(() => {
    const deletePastMeetings = async () => {
      const current = meetingsRef.current;
      if (!Array.isArray(current) || current.length === 0) return;
      const now = new Date();
      const past = current.filter((m) => m.endTime && new Date(m.endTime) <= now);
      if (past.length === 0) return;
      const pastIds = past.map((m) => m.id);
      for (const m of past) {
        try {
          await meetingsApi.deleteMeeting(m.id);
        } catch {
          // ignore auto-delete errors
        }
      }
      setMeetings((prev) => prev.filter((m) => !pastIds.includes(m.id)));
    };

    deletePastMeetings();
    const id = setInterval(deletePastMeetings, 60000);
    return () => clearInterval(id);
  }, []);

  const addAdditionalEmail = () => setAdditionalEmails((p) => [...p, ""]);
  const setAdditionalEmail = (i, v) => {
    setAdditionalEmails((p) => {
      const n = [...p];
      n[i] = v;
      return n;
    });
  };
  const removeAdditionalEmail = (i) => setAdditionalEmails((p) => p.filter((_, idx) => idx !== i));

  const handleDeleteMeeting = async () => {
    if (!meetingToDelete) return;
    setDeletingMeetingId(meetingToDelete);
    setError("");
    try {
      await meetingsApi.deleteMeeting(meetingToDelete);
      setMeetings((prev) => prev.filter((m) => m.id !== meetingToDelete));
      setMeetingToDelete(null);
    } catch (e) {
      setError(e.message || "Failed to delete meeting");
      console.error("Delete failed:", e);
    } finally {
      setDeletingMeetingId(null);
    }
  };

  const selectedTimezone = displayTimezone === "IST" ? "Asia/Kolkata" : "Europe/Dublin";

  /** Display week: 7 days starting at weekStart (UTC), matching API grid. */
  const displayWeekInfo = useMemo(() => {
    const weekStartDt = DateTime.fromISO(weekStart + "T00:00:00Z");
    const dayKeys = [0, 1, 2, 3, 4, 5, 6].map((i) =>
      weekStartDt.plus({ days: i }).toFormat("yyyy-MM-dd")
    );
    return {
      weekStartDt,
      dayKeys,
      weekLabel: weekStartDt.setZone(selectedTimezone).toFormat("ccc, dd LLL"),
    };
  }, [weekStart, selectedTimezone]);

  const prevWeek = () => {
    setWeekStart(
      DateTime.fromISO(weekStart + "T00:00:00Z").minus({ days: 7 }).toFormat("yyyy-MM-dd")
    );
  };
  const nextWeek = () => {
    setWeekStart(
      DateTime.fromISO(weekStart + "T00:00:00Z").plus({ days: 7 }).toFormat("yyyy-MM-dd")
    );
  };

  /** Group slots by backend date key; only time display converts to tz. Keeps cross-midnight slots on original day. */
  const groupSlotsByLocalDate = useCallback((data, tz) => {
    if (!data || !data.availability) return { dates: [], byDate: {} };

    const byDate = {};

    for (const [dateKey, slots] of Object.entries(data.availability)) {
      for (const slot of slots || []) {
        const localStart = DateTime.fromISO(slot.startTime, { zone: "utc" }).setZone(tz);
        const localEnd = DateTime.fromISO(slot.endTime, { zone: "utc" }).setZone(tz);

        const convertedStart = localStart.toFormat("HH:mm");
        const convertedEnd = localEnd.toFormat("HH:mm");

        if (!byDate[dateKey]) {
          const label = DateTime.fromISO(dateKey + "T00:00:00", { zone: tz }).toFormat("ccc, dd LLL");
          byDate[dateKey] = { dayLabel: label, slots: [] };
        }

        byDate[dateKey].slots.push({
          ...slot,
          convertedStart,
          convertedEnd,
        });
      }
    }

    return { dates: Object.keys(byDate).sort(), byDate };
  }, []);

  /** Group flat slots (with startTime/endTime) by local date in selected timezone. */
  const groupFlatSlotsByLocalDate = useCallback((slots, tz) => {
    if (!Array.isArray(slots) || slots.length === 0) return { dates: [], byDate: {} };
    const byDate = {};
    for (const slot of slots) {
      const localStart = DateTime.fromISO(slot.startTime, { zone: "utc" }).setZone(tz);
      const localEnd = DateTime.fromISO(slot.endTime, { zone: "utc" }).setZone(tz);
      const localDateKey = localStart.toFormat("yyyy-MM-dd");
      const dayLabel = localStart.toFormat("ccc, dd LLL");
      const convertedStart = localStart.toFormat("HH:mm");
      const convertedEnd = localEnd.toFormat("HH:mm");
      if (!byDate[localDateKey]) byDate[localDateKey] = { dayLabel, slots: [] };
      byDate[localDateKey].slots.push({ ...slot, convertedStart, convertedEnd });
    }
    return { dates: Object.keys(byDate).sort(), byDate };
  }, []);

  const flattenSlots = (data) =>
    !data
      ? []
      : Object.entries(data.availability || {}).flatMap(([dateStr, slots]) =>
          (slots || []).map((s) => ({ ...s, dateStr }))
        );

  const userSlotsFlat = flattenSlots(userAvailability);
  const mentorSlotsFlat = flattenSlots(mentorAvailability);

  const userByLocalDate = useMemo(
    () => groupFlatSlotsByLocalDate(userSlotsFlat, selectedTimezone),
    [userSlotsFlat, selectedTimezone, groupFlatSlotsByLocalDate]
  );

  const mentorByLocalDate = useMemo(
    () => groupFlatSlotsByLocalDate(mentorSlotsFlat, selectedTimezone),
    [mentorSlotsFlat, selectedTimezone, groupFlatSlotsByLocalDate]
  );

  const upcomingDays = useMemo(() => {
    const today = DateTime.now().setZone(selectedTimezone).startOf("day");
    return Array.from({ length: 7 }, (_, i) => {
      const d = today.plus({ days: i });
      return {
        key: d.toFormat("yyyy-MM-dd"),
        label: d.toFormat("ccc, dd LLL"),
      };
    });
  }, [selectedTimezone]);

  const formatSlotsForDay = (slots, emptyLabel = "No availability") => {
    if (!slots || slots.length === 0) return emptyLabel;
    return slots
      .map((slot) => formatTimeRange(`${slot.convertedStart} – ${slot.convertedEnd}`))
      .join(", ");
  };

  const parseHmToMinutes = (hm) => {
    if (!hm) return null;
    const [hStr, mStr] = hm.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const minutesToHm = (minutes) => {
    let total = minutes;
    if (total < 0) total = 0;
    if (total > 1440) total = 1440;
    if (total === 1440) total = 0; // treat midnight as 00:00 of next day
    const h = Math.floor(total / 60);
    const m = total % 60;
    const hh = h.toString().padStart(2, "0");
    const mm = m.toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const computeCommonSlotsForDay = (userSlots = [], mentorSlots = []) => {
    const results = [];
    for (const u of userSlots) {
      const uStart = parseHmToMinutes(u.convertedStart);
      const uEndRaw = parseHmToMinutes(u.convertedEnd);
      if (uStart == null || uEndRaw == null) continue;
      let uEnd = uEndRaw;
      if (uEnd <= uStart) uEnd += 1440; // handle local cross-midnight

      for (const m of mentorSlots) {
        const mStart = parseHmToMinutes(m.convertedStart);
        const mEndRaw = parseHmToMinutes(m.convertedEnd);
        if (mStart == null || mEndRaw == null) continue;
        let mEnd = mEndRaw;
        if (mEnd <= mStart) mEnd += 1440;

        let start = Math.max(uStart, mStart, 0);
        let end = Math.min(uEnd, mEnd, 1440);

        if (end <= start) continue; // no overlap or just touching

        const startHm = minutesToHm(start);
        const endHm = minutesToHm(end);
        results.push({ startHm, endHm });
      }
    }
    return results;
  };

  const meetingsByDate = useMemo(() => {
    if (!Array.isArray(meetings) || meetings.length === 0) return {};
    const byDate = {};
    for (const m of meetings) {
      if (!m.startTime) continue;
      const start = DateTime.fromISO(m.startTime, { zone: "utc" }).setZone(selectedTimezone);
      const end = m.endTime
        ? DateTime.fromISO(m.endTime, { zone: "utc" }).setZone(selectedTimezone)
        : null;
      const key = start.toFormat("yyyy-MM-dd");
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push({
        ...m,
        localStartLabel: start.toFormat("h:mm a"),
        localEndLabel: end ? end.toFormat("h:mm a") : "",
      });
    }
    Object.keys(byDate).forEach((k) => {
      byDate[k].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    });
    return byDate;
  }, [meetings, selectedTimezone]);

  const parse12HourTo24 = (timeStr) => {
    if (!timeStr) return "";
    const parts = timeStr.trim().split(/\s+/);
    if (parts.length < 2) return "";
    const time = parts[0];
    const periodRaw = parts[1] || "";
    const period = periodRaw.toUpperCase();
    const [hStr, mStr = "00"] = time.split(":");
    let h = Number(hStr);
    const m = Number(mStr);
    if (Number.isNaN(h) || Number.isNaN(m)) return "";

    if (period === "AM") {
      if (h === 12) h = 0;
    } else if (period === "PM") {
      if (h !== 12) h += 12;
    }

    const hh = `${h}`.padStart(2, "0");
    const mm = `${m}`.padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const parse12RangeTo24 = (rangeStr) => {
    if (!rangeStr) return { start: "", end: "" };
    const parts = rangeStr.split("–");
    if (parts.length !== 2) return { start: "", end: "" };
    const start12 = parts[0].trim();
    const end12 = parts[1].trim();
    return {
      start: parse12HourTo24(start12),
      end: parse12HourTo24(end12),
    };
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex flex-row items-start gap-4 w-full">
        {/* LEFT: Availability Viewer */}
        <div
          className="min-w-0 overflow-hidden space-y-4"
          style={{ flex: "0 0 70%", width: "70%", maxWidth: "70%" }}
        >
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 font-medium mt-1">
              View user/mentor availability, find overlaps, and schedule meetings.
            </p>
          </div>

          <div className="w-full flex flex-wrap md:flex-nowrap items-end gap-4">
            <div className="w-full md:flex-1">
              <label className="block text-sm font-medium text-slate-400 mb-1">Timezone</label>
              <select
                value={displayTimezone}
                onChange={(e) => setDisplayTimezone(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 text-white font-medium px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full md:flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-slate-400 mb-1">User</label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-[260px] group">
                  <select
                    value={selectedUser ? selectedUser.id : ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        setSelectedUser(null);
                        setUserEmail("");
                        return;
                      }
                      setSelectedUser(users.find((u) => u.id === id) || null);
                    }}
                    className="w-full min-w-[260px] h-11 appearance-none rounded-xl bg-slate-900 border border-slate-800 text-white font-medium px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition shadow-sm"
                  >
                    <option value="">Select user</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg
                      className="w-4 h-4 text-slate-400 transition-transform group-focus-within:rotate-180"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(true)}
                  disabled={!selectedUser}
                  className="h-11 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:hover:bg-slate-800 text-white disabled:text-slate-500 font-medium px-4 transition inline-flex items-center gap-2"
                  title="Add user"
                >
                  <span aria-hidden>+</span> Add
                </button>
              </div>
            </div>
            <div className="w-full md:flex-1 min-w-[220px]">
              <label className="block text-sm font-medium text-slate-400 mb-1">Mentor</label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-[260px] group">
                  <select
                    value={selectedMentor ? selectedMentor.id : ""}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) {
                        setSelectedMentor(null);
                        setMentorEmail("");
                        return;
                      }
                      setSelectedMentor(mentors.find((m) => m.id === id) || null);
                    }}
                    className="w-full min-w-[260px] h-11 appearance-none rounded-xl bg-slate-900 border border-slate-800 text-white font-medium px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition shadow-sm"
                  >
                    <option value="">Select mentor</option>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg
                      className="w-4 h-4 text-slate-400 transition-transform group-focus-within:rotate-180"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddMentorModal(true)}
                  disabled={!selectedMentor}
                  className="h-11 rounded-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:hover:bg-slate-800 text-white disabled:text-slate-500 font-medium px-4 transition inline-flex items-center gap-2"
                  title="Add mentor"
                >
                  <span aria-hidden>+</span> Add
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden p-4 flex flex-col">
            {!availabilityTarget ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Meetings</h3>
                    <p className="text-xs text-slate-400">
                      Showing today and next 6 days
                    </p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                    {upcomingDays.map(({ key, label }) => {
                      const dayMeetings = meetingsByDate[key] || [];
                      const day = DateTime.fromISO(`${key}T00:00:00`, { zone: selectedTimezone });
                      const dayName = day.toFormat("ccc");
                      const dayDate = day.toFormat("dd LLL");
                      const tzLabel = displayTimezone === "IST" ? "IST" : "GMT";
                      return (
                        <div
                          key={key}
                          className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 flex flex-col min-h-[120px]"
                        >
                          <div className="mb-2">
                            <p className="text-xs font-semibold text-slate-200">{dayName}</p>
                            <p className="text-xs text-slate-500">{dayDate}</p>
                          </div>
                          <div className="space-y-2">
                            {dayMeetings.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setActiveMeeting(m)}
                                className="w-full text-left rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 hover:bg-slate-800 transition"
                              >
                                <p className="text-xs font-semibold text-white truncate">{m.title}</p>
                                <p className="text-[11px] text-slate-300 mt-0.5">
                                  {m.localStartLabel} – {m.localEndLabel} {tzLabel}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : loadingUserAvail || loadingMentorAvail ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-slate-400 text-sm">Loading availability...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedUser && (
                      <span className="text-slate-300 text-sm">
                        User: {selectedUser.name}
                      </span>
                    )}
                    {selectedUser && selectedMentor && <span className="text-slate-500">|</span>}
                    {selectedMentor && (
                      <span className="text-slate-300 text-sm">
                        Mentor: {selectedMentor.name}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-400 text-xs">
                    Showing today and next 6 days ({displayTimezone})
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full border-collapse table-auto">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="py-4 px-4 text-left text-sm font-semibold text-slate-200 w-[150px] whitespace-nowrap">
                          Date
                        </th>
                        <th className="py-4 px-4 text-left text-sm font-semibold text-slate-200 whitespace-nowrap">
                          User Availability
                        </th>
                        <th className="py-4 px-4 text-left text-xs md:text-sm font-semibold text-slate-200 whitespace-nowrap">
                          Mentor Availability
                        </th>
                        <th className="py-4 px-4 text-left text-sm font-semibold text-slate-200 whitespace-nowrap">
                          Common Times
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingDays.map(({ key, label }, index) => {
                        const userSlots = userByLocalDate.byDate[key]?.slots ?? [];
                        const mentorSlots = mentorByLocalDate.byDate[key]?.slots ?? [];
                        const commonIntervals = computeCommonSlotsForDay(userSlots, mentorSlots);
                        const commonText =
                          commonIntervals.length > 0
                            ? commonIntervals
                                .map(({ startHm, endHm }) =>
                                  formatTimeRange(`${startHm} – ${endHm}`)
                                )
                                .join(", ")
                            : "—";
                        const rowBg =
                          index % 2 === 0 ? "bg-slate-900/40" : "bg-slate-900/20";
                        return (
                          <tr key={key} className={`${rowBg} border-b border-slate-800/80`}>
                            <td className="py-4 px-4 text-sm font-semibold text-slate-200 whitespace-nowrap align-middle">
                              {label}
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-300 align-top">
                              {userSlots.length === 0 ? (
                                <span className="text-slate-500">No availability</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {userSlots.map((slot) => (
                                    <span
                                      key={slot.startTime}
                                      className="inline-flex items-center rounded-md bg-slate-800/90 border border-slate-600 px-2 py-1 text-xs text-slate-100"
                                    >
                                      {formatTimeRange(
                                        `${slot.convertedStart} – ${slot.convertedEnd}`
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-300 align-top">
                              {mentorSlots.length === 0 ? (
                                <span className="text-slate-500">No availability</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {mentorSlots.map((slot) => (
                                    <span
                                      key={slot.startTime}
                                      className="inline-flex items-center rounded-md bg-slate-800/90 border border-slate-600 px-2 py-1 text-xs text-slate-100"
                                    >
                                      {formatTimeRange(
                                        `${slot.convertedStart} – ${slot.convertedEnd}`
                                      )}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-100 align-top">
                              {commonIntervals.length === 0 ? (
                                <span className="text-slate-500">—</span>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {commonIntervals.map(({ startHm, endHm }, idx) => {
                                    const slotKey = `${key}-${startHm}-${endHm}`;
                                    const isSelected = selectedCommonSlot === slotKey;
                                    return (
                                      <button
                                        key={slotKey}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCommonSlot(slotKey);
                                          const dateStr = key; // yyyy-MM-dd in selected timezone
                                          const labelRange = formatTimeRange(`${startHm} – ${endHm}`);
                                          const { start, end } = parse12RangeTo24(labelRange);
                                          setScheduleDate(dateStr);
                                          if (start) {
                                            const p = hm24To12Parts(start);
                                            setScheduleStartHour(p.hour);
                                            setScheduleStartMinute(p.minute);
                                            setScheduleStartAmPm(p.amPm);
                                          }
                                          if (end) {
                                            const p = hm24To12Parts(end);
                                            setScheduleEndHour(p.hour);
                                            setScheduleEndMinute(p.minute);
                                            setScheduleEndAmPm(p.amPm);
                                          }
                                          setScheduleInlineError("");

                                          const userEmailLocal = userEmail || selectedUser?.email || "";
                                          const mentorEmailLocal = mentorEmail || selectedMentor?.email || "";
                                          const userName =
                                            userEmailLocal.split("@")[0] || "user";
                                          const mentorName =
                                            mentorEmailLocal.split("@")[0] || "mentor";
                                          setScheduleTitle(`MTQ<>${userName}:${mentorName}`);
                                        }}
                                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs ${
                                          isSelected
                                            ? "bg-emerald-700 border border-emerald-300 text-emerald-50"
                                            : "bg-emerald-800/70 border border-emerald-400 text-emerald-100"
                                        }`}
                                      >
                                        {formatTimeRange(`${startHm} – ${endHm}`)}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: Schedule Meeting sidebar */}
        <div
          className="min-w-0 flex-shrink-0"
          style={{ flex: "0 0 30%", width: "30%", maxWidth: "30%" }}
        >
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-3">Schedule Meeting</h2>
            <form onSubmit={handleScheduleMeeting} className="space-y-3 flex-1 flex flex-col">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Admin email</label>
                <input
                  type="email"
                  value={adminEmail}
                  disabled
                  className="w-full box-border rounded-lg bg-slate-950 border border-slate-800 text-slate-400 px-4 py-1.5 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">User email</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full box-border rounded-lg bg-slate-950 border border-slate-800 text-white px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Mentor email</label>
                <input
                  type="email"
                  value={mentorEmail}
                  onChange={(e) => setMentorEmail(e.target.value)}
                  className="w-full box-border rounded-lg bg-slate-950 border border-slate-800 text-white px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="mentor@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Additional emails</label>
                {additionalEmails.map((email, i) => (
                  <div key={i} className="flex items-stretch gap-2 mb-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setAdditionalEmail(i, e.target.value)}
                      className="flex-1 min-w-0 box-border rounded-lg bg-slate-950 border border-slate-800 text-white px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="email@example.com"
                    />
                    <button
                      type="button"
                      onClick={() => removeAdditionalEmail(i)}
                      className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-slate-400 hover:text-white text-sm whitespace-nowrap"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAdditionalEmail}
                  className="text-sm text-blue-400 hover:underline"
                >
                  + Add email
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Meeting name</label>
                <input
                  type="text"
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  required
                  className="w-full box-border rounded-lg bg-slate-950 border border-slate-800 text-white px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Meeting title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => {
                    setScheduleDate(e.target.value);
                    setScheduleInlineError("");
                  }}
                  className="w-full box-border rounded-lg bg-slate-950 border border-slate-800 text-white px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Start time</label>
                <div className="flex items-center gap-2">
                  <select
                    value={scheduleStartHour}
                    onChange={(e) => {
                      setScheduleStartHour(e.target.value);
                      setScheduleInlineError("");
                    }}
                    className={scheduleTimeSelectClass}
                    aria-label="Start hour"
                  >
                    <option value="">Hour</option>
                    {SCHEDULE_HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-400 shrink-0" aria-hidden>
                    :
                  </span>
                  <select
                    value={scheduleStartMinute}
                    onChange={(e) => {
                      setScheduleStartMinute(e.target.value);
                      setScheduleInlineError("");
                    }}
                    className={scheduleTimeSelectClass}
                    aria-label="Start minute"
                  >
                    <option value="">Min</option>
                    {SCHEDULE_MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={scheduleStartAmPm}
                    onChange={(e) => {
                      setScheduleStartAmPm(e.target.value);
                      setScheduleInlineError("");
                    }}
                    className={scheduleTimeSelectClass}
                    aria-label="Start AM or PM"
                  >
                    <option value="">AM/PM</option>
                    {SCHEDULE_AMPM_OPTIONS.map((ap) => (
                      <option key={ap} value={ap}>
                        {ap}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">End time</label>
                <div className="flex items-center gap-2">
                  <select
                    value={scheduleEndHour}
                    onChange={(e) => {
                      setScheduleEndHour(e.target.value);
                      setScheduleInlineError("");
                    }}
                    className={scheduleTimeSelectClass}
                    aria-label="End hour"
                  >
                    <option value="">Hour</option>
                    {SCHEDULE_HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="text-slate-400 shrink-0" aria-hidden>
                    :
                  </span>
                  <select
                    value={scheduleEndMinute}
                    onChange={(e) => {
                      setScheduleEndMinute(e.target.value);
                      setScheduleInlineError("");
                    }}
                    className={scheduleTimeSelectClass}
                    aria-label="End minute"
                  >
                    <option value="">Min</option>
                    {SCHEDULE_MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={scheduleEndAmPm}
                    onChange={(e) => {
                      setScheduleEndAmPm(e.target.value);
                      setScheduleInlineError("");
                    }}
                    className={scheduleTimeSelectClass}
                    aria-label="End AM or PM"
                  >
                    <option value="">AM/PM</option>
                    {SCHEDULE_AMPM_OPTIONS.map((ap) => (
                      <option key={ap} value={ap}>
                        {ap}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {scheduleInlineError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs px-3 py-2">
                  {scheduleInlineError}
                </div>
              )}
              {success && (
                <div className="rounded-lg bg-emerald-900/30 border border-emerald-500/40 text-emerald-200 text-xs px-3 py-2">
                  {success}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 transition disabled:opacity-50"
              >
                {loading ? "Saving..." : "Schedule Meeting"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Meetings calendar - full width below (when availability is shown) */}
      {availabilityTarget && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 mt-4">
          <h2 className="text-lg font-semibold text-white mb-4">Meetings</h2>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {upcomingDays.map(({ key, label }) => {
              const dayMeetings = meetingsByDate[key] || [];
              const day = DateTime.fromISO(`${key}T00:00:00`, { zone: selectedTimezone });
              const dayName = day.toFormat("ccc");
              const dayDate = day.toFormat("dd LLL");
              const tzLabel = displayTimezone === "IST" ? "IST" : "GMT";
              return (
                <div
                  key={key}
                  className="rounded-xl bg-slate-900/80 border border-slate-800 px-3 py-2 flex flex-col min-h-[120px]"
                >
                  <div className="mb-2">
                    <p className="text-xs font-semibold text-slate-200">{dayName}</p>
                    <p className="text-xs text-slate-500">{dayDate}</p>
                  </div>
                  <div className="space-y-2">
                    {dayMeetings.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setActiveMeeting(m)}
                        className="w-full text-left rounded-lg bg-slate-800/80 border border-slate-700 px-3 py-2 hover:bg-slate-800 transition"
                      >
                        <p className="text-xs font-semibold text-white truncate">{m.title}</p>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          {m.localStartLabel} – {m.localEndLabel} {tzLabel}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Meeting details modal */}
      {activeMeeting && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setActiveMeeting(null)}
        >
          <div
            className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-3">
              {activeMeeting.title}
            </h3>
            <p className="text-sm text-slate-300 mb-2">
              {activeMeeting.startTime &&
                new Date(activeMeeting.startTime).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: displayTimezone === "IST" ? "Asia/Kolkata" : "UTC",
                })}
            </p>
            <p className="text-sm text-slate-200 mb-4">
              {formatSlotLabel(activeMeeting.startTime, activeMeeting.endTime, displayTimezone)}{" "}
              ({displayTimezone === "IST" ? "IST" : "GMT"})
            </p>

            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 mb-1">Attendees</p>
              {activeMeeting.participants?.length ? (
                <ul className="text-xs text-slate-200 space-y-0.5">
                  {activeMeeting.participants.map((p) => (
                    <li key={p.email}>{p.email}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No attendees listed</p>
              )}
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-400 mb-1">Google Meet link</p>
              {activeMeeting.meetLink ? (
                <div className="flex items-center gap-2">
                  <a
                    href={activeMeeting.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline break-all flex-1"
                  >
                    {activeMeeting.meetLink}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeMeeting) return;
                      const tzLabel =
                        displayTimezone === "IST" ? "IST (GMT+5:30)" : "GMT (GMT+0)";
                      const datePart = activeMeeting.startTime
                        ? new Date(activeMeeting.startTime).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            timeZone: displayTimezone === "IST" ? "Asia/Kolkata" : "UTC",
                          })
                        : "";
                      const timeRange =
                        activeMeeting.startTime && activeMeeting.endTime
                          ? formatSlotLabel(
                              activeMeeting.startTime,
                              activeMeeting.endTime,
                              displayTimezone
                            )
                          : "";
                      const attendees =
                        activeMeeting.participants && activeMeeting.participants.length
                          ? activeMeeting.participants.map((p) => p.email).join(", ")
                          : "";
                      const lines = [
                        activeMeeting.title || "",
                        datePart && timeRange
                          ? `${datePart} · ${timeRange}`
                          : datePart || timeRange,
                        `Time zone: ${tzLabel}`,
                        `Attendees: ${attendees}`,
                        "Google Meet joining info",
                        `Video call link: ${activeMeeting.meetLink || "Link pending"}`,
                      ].join("\n");

                      navigator.clipboard.writeText(lines);
                      setCopiedMeetingDetails(true);
                      setTimeout(() => setCopiedMeetingDetails(false), 1500);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium px-2 py-1"
                  >
                    {copiedMeetingDetails ? "Copied!" : "Copy"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Link pending</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setActiveMeeting(null)}
                className="rounded-lg border border-slate-600 bg-slate-800 text-slate-300 font-medium px-4 py-2 text-xs hover:bg-slate-700 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setMeetingToDelete(activeMeeting.id);
                  setActiveMeeting(null);
                }}
                className="rounded-lg border border-red-500 bg-red-600 text-white font-medium px-4 py-2 text-xs hover:bg-red-500 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete meeting confirmation modal */}
      {meetingToDelete !== null && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => !deletingMeetingId && setMeetingToDelete(null)}
        >
          <div
            className="rounded-2xl bg-slate-900 border border-slate-800 shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Delete Meeting?</h3>
            <p className="text-slate-400 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setMeetingToDelete(null)}
                disabled={!!deletingMeetingId}
                className="rounded-lg border border-slate-600 bg-slate-800 text-slate-300 font-medium px-4 py-2 hover:bg-slate-700 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMeeting}
                disabled={!!deletingMeetingId}
                className="rounded-lg border border-red-500 bg-red-600 text-white font-medium px-4 py-2 hover:bg-red-500 transition disabled:opacity-50"
              >
                {deletingMeetingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddUserModal && (
        <AddUserModal
          onClose={() => setShowAddUserModal(false)}
          onSuccess={(user) => {
            setSelectedUser(user);
            loadUsers();
          }}
        />
      )}
      {showAddMentorModal && (
        <AddMentorModal
          onClose={() => setShowAddMentorModal(false)}
          onSuccess={(mentor) => {
            setSelectedMentor(mentor);
            loadUsers();
          }}
        />
      )}
    </div>
  );
}
