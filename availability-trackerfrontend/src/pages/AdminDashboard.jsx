import { useState, useEffect, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import { useAuth } from "../context/AuthContext";
import * as adminApi from "../api/admin";
import * as meetingsApi from "../api/meetings";
import CustomDropdown from "../components/CustomDropdown";
import CustomDatePicker from "../components/CustomDatePicker";
import CustomTimePicker from "../components/CustomTimePicker";
import {
  Target,
  Tag,
  Calendar,
  Sparkles,
  ArrowRight,
  FileText,
  Globe,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  Clock,
  User,
  Check,
  Award,
  Edit2,
  Trash2,
  UserPlus,
  Search,
  SlidersHorizontal,
  AlertTriangle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  ChevronRight,
} from "lucide-react";

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "GMT (GMT+0)" },
  { value: "IST", label: "IST (GMT+5:30)" },
];

const CALL_TYPES = [
  { id: "RESUME_REVAMP", label: "Resume Revamp", icon: FileText, req: "Big Tech / Public Company Mentor" },
  { id: "JOB_MARKET_GUIDANCE", label: "Job Market Guidance", icon: Globe, req: "Good Communication Mentor" },
  { id: "MOCK_INTERVIEW", label: "Mock Interview", icon: Target, req: "Domain Match (Tech / Non-tech)" },
];

const SCHEDULE_HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const SCHEDULE_MINUTE_OPTIONS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const SCHEDULE_AMPM_OPTIONS = ["AM", "PM"];

const scheduleTimeSelectClass =
  "min-w-0 flex-1 box-border rounded-lg bg-navy-950 border border-navy-700 text-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none";

/**
 * Utility to convert a slot ({ dayOfWeek: 0..6, hour: 0..23 }) and weekStart string (YYYY-MM-DD)
 * into formatted date, start/end hour strings, AM/PM, and time label.
 */
function getSlotDateTime(slot, weekStartStr) {
  if (!slot) {
    return {
      dateStr: "",
      startHour: "10",
      startAmPm: "AM",
      endHour: "11",
      endAmPm: "AM",
      label: "10:00 AM – 11:00 AM",
    };
  }

  try {
    const dayOfWeek = typeof slot.dayOfWeek === "number" ? slot.dayOfWeek : 0;
    const hour = typeof slot.hour === "number" ? slot.hour : 10;

    let baseDate = DateTime.fromISO(weekStartStr || DateTime.now().toFormat("yyyy-MM-dd"), { zone: "utc" });
    if (!baseDate.isValid) {
      baseDate = DateTime.now().toUTC();
    }

    const slotDate = baseDate.plus({ days: dayOfWeek }).set({ hour, minute: 0, second: 0, millisecond: 0 });
    const endDate = slotDate.plus({ hours: 1 });

    const formatHour12 = (dt) => {
      const h = dt.hour % 12;
      return String(h === 0 ? 12 : h);
    };

    const dateStr = slotDate.toFormat("yyyy-MM-dd");
    const startHour = formatHour12(slotDate);
    const startAmPm = slotDate.toFormat("a");
    const endHour = formatHour12(endDate);
    const endAmPm = endDate.toFormat("a");

    const startLabel = slotDate.toFormat("h:mm a");
    const endLabel = endDate.toFormat("h:mm a");
    const dayName = slotDate.toFormat("ccc");
    const label = `${dayName} ${startLabel} – ${endLabel}`;

    return {
      dateStr,
      startHour,
      startAmPm,
      endHour,
      endAmPm,
      label,
    };
  } catch (err) {
    console.error("Error in getSlotDateTime:", err);
    return {
      dateStr: weekStartStr || "",
      startHour: "10",
      startAmPm: "AM",
      endHour: "11",
      endAmPm: "AM",
      label: "10:00 AM – 11:00 AM",
    };
  }
}

function sanitizeMatchReason(reason) {
  if (!reason || typeof reason !== "string") return reason;
  let cleaned = reason
    .replace(/Dense Semantic Vector\s*\(Local RAG\)\s*/gi, "")
    .replace(/RAG similarity:\s*/gi, "")
    .replace(/RAG\s*/gi, "")
    .replace(/Local\s*/gi, "")
    .replace(/Dense Semantic Vector\s*/gi, "")
    .replace(/\(\+\d+\s*pts?\)\s*/gi, "")
    .replace(/\(\-\d+\s*pts?\)\s*/gi, "")
    .replace(/[+-]\d+\s*pts?\.?\s*/gi, "")
    .replace(/\d+%\s*match/gi, (m) => m.replace(/match/i, "alignment"))
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || reason;
}

export default function AdminDashboard() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [activeTab, setActiveTab] = useState("recommendations");
  
  // Selection state
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [selectedCallType, setSelectedCallType] = useState("RESUME_REVAMP");
  const [displayTimezone, setDisplayTimezone] = useState("UTC");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [showUserSelectModal, setShowUserSelectModal] = useState(false);
  const [userModalPage, setUserModalPage] = useState(1);
  const [slotModalRec, setSlotModalRec] = useState(null);
  
  // Scheduled Meetings Actions state
  const [meetingSearchQuery, setMeetingSearchQuery] = useState("");
  const [selectedViewMeeting, setSelectedViewMeeting] = useState(null);
  const [selectedEditMeeting, setSelectedEditMeeting] = useState(null);
  const [selectedCancelMeeting, setSelectedCancelMeeting] = useState(null);

  // Edit Form state
  const [editTitle, setEditTitle] = useState("");
  const [editCallType, setEditCallType] = useState("RESUME_REVAMP");
  const [editDate, setEditDate] = useState("");
  const [editStartHour, setEditStartHour] = useState("10");
  const [editStartMinute, setEditStartMinute] = useState("00");
  const [editStartAmPm, setEditStartAmPm] = useState("AM");
  const [editEndHour, setEditEndHour] = useState("11");
  const [editEndMinute, setEditEndMinute] = useState("00");
  const [editEndAmPm, setEditEndAmPm] = useState("AM");
  const [updatingMeeting, setUpdatingMeeting] = useState(false);
  const [cancelingMeeting, setCancelingMeeting] = useState(false);
  
  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [overlapOnlyFilter, setOverlapOnlyFilter] = useState(false);
  
  // Availability state — always use Monday of the current week so dayOfWeek indices
  // (0=Mon … 6=Sun) align with the template convention used by the backend.
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    const base = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const day = base.getUTCDay();
    const diff = base.getUTCDate() - day + (day === 0 ? -6 : 1);
    base.setUTCDate(diff);
    base.setUTCHours(0, 0, 0, 0);
    return base.toISOString().slice(0, 10);
  });
  
  // Meetings & Schedule state
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
  
  // Member Settings & Management state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL"); // ALL, MENTOR, USER
  
  // Add Member Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("password123");
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addRole, setAddRole] = useState("MENTOR");
  const [addTimezone, setAddTimezone] = useState("UTC");
  const [addDesc, setAddDesc] = useState("");
  const [addTags, setAddTags] = useState("");
  const [addingMember, setAddingMember] = useState(false);

  // Edit Member Modal
  const [editingTarget, setEditingTarget] = useState(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("MENTOR");
  const [editTimezone, setEditTimezone] = useState("UTC");
  const [editDesc, setEditDesc] = useState("");
  const [editTags, setEditTags] = useState("");
  const [savingMember, setSavingMember] = useState(false);

  // Delete Member Modal
  const [deletingTarget, setDeletingTarget] = useState(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const [u, m] = await Promise.all([adminApi.listUsers(), adminApi.listMentors()]);
      setUsers(u);
      setMentors(m);
    } catch (e) {
      setError(e.message || "Failed to load members");
    }
  }, [selectedUser]);

  const loadMeetings = useCallback(async () => {
    try {
      const list = await meetingsApi.listMeetings();
      setMeetings(list);
    } catch {
      setMeetings([]);
    }
  }, []);

  const handleOpenEditMeeting = (m) => {
    setSelectedEditMeeting(m);
    setEditTitle(m.title || "");
    setEditCallType(m.callType || "RESUME_REVAMP");

    if (m.startTime) {
      const dt = DateTime.fromISO(m.startTime);
      setEditDate(dt.toFormat("yyyy-MM-dd"));
      setEditStartHour(dt.toFormat("hh"));
      setEditStartMinute(dt.toFormat("mm"));
      setEditStartAmPm(dt.toFormat("a"));
    }
    if (m.endTime) {
      const dtEnd = DateTime.fromISO(m.endTime);
      setEditEndHour(dtEnd.toFormat("hh"));
      setEditEndMinute(dtEnd.toFormat("mm"));
      setEditEndAmPm(dtEnd.toFormat("a"));
    }
  };

  const handleSaveUpdateMeeting = async (e) => {
    e.preventDefault();
    if (!selectedEditMeeting) return;
    setUpdatingMeeting(true);
    try {
      const parseHour = (h, ampm) => {
        let n = parseInt(h, 10);
        if (ampm === "PM" && n < 12) n += 12;
        if (ampm === "AM" && n === 12) n = 0;
        return String(n).padStart(2, "0");
      };

      const startIso = `${editDate}T${parseHour(editStartHour, editStartAmPm)}:${editStartMinute}:00.000Z`;
      const endIso = `${editDate}T${parseHour(editEndHour, editEndAmPm)}:${editEndMinute}:00.000Z`;

      await meetingsApi.updateMeeting(selectedEditMeeting.id, {
        title: editTitle,
        callType: editCallType,
        startTime: startIso,
        endTime: endIso,
      });

      setSuccess("Meeting updated successfully!");
      setSelectedEditMeeting(null);
      loadMeetings();
    } catch (err) {
      setError(err.message || "Failed to update meeting");
    } finally {
      setUpdatingMeeting(false);
    }
  };

  const handleConfirmCancelMeeting = async () => {
    if (!selectedCancelMeeting) return;
    setCancelingMeeting(true);
    try {
      await meetingsApi.deleteMeeting(selectedCancelMeeting.id);
      setSuccess("Meeting cancelled successfully!");
      setSelectedCancelMeeting(null);
      loadMeetings();
    } catch (err) {
      setError(err.message || "Failed to cancel meeting");
    } finally {
      setCancelingMeeting(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadMeetings();
  }, [loadUsers, loadMeetings]);

  const fetchRecommendations = useCallback(async () => {
    if (!selectedUser) {
      setRecommendations([]);
      return;
    }
    setLoadingRecs(true);
    try {
      const data = await adminApi.getRecommendations(selectedUser.id, selectedCallType, weekStart);
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.error("Recs error:", err);
      setRecommendations([]);
    } finally {
      setLoadingRecs(false);
    }
  }, [selectedUser, selectedCallType, weekStart]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Clear stale slot modal when recommendations change (new user / call type / week)
  useEffect(() => {
    setSlotModalRec(null);
  }, [recommendations]);

  useEffect(() => {
    if (selectedUser) setUserEmail(selectedUser.email);
  }, [selectedUser]);
  useEffect(() => {
    if (selectedMentor) setMentorEmail(selectedMentor.email);
  }, [selectedMentor]);

  const [selectedSlotKey, setSelectedSlotKey] = useState("");

  const handleSelectMentorForCall = (rec, specificSlot = null) => {
    setSelectedMentor(rec.mentor);
    setMentorEmail(rec.mentor.email);
    setScheduleTitle(`${CALL_TYPES.find((c) => c.id === selectedCallType)?.label || "Mentoring Call"}: ${selectedUser?.name || "User"} x ${rec.mentor.name}`);
    
    const slotToUse = specificSlot || (rec.overlappingSlots && rec.overlappingSlots.length > 0 ? rec.overlappingSlots[0] : null);

    if (slotToUse) {
      setSelectedSlotKey(`${rec.mentor.id}_${slotToUse.dayOfWeek}_${slotToUse.hour}`);
      const slotInfo = getSlotDateTime(slotToUse, weekStart);
      setScheduleDate(slotInfo.dateStr);
      setScheduleStartHour(slotInfo.startHour);
      setScheduleStartMinute("00");
      setScheduleStartAmPm(slotInfo.startAmPm);
      setScheduleEndHour(slotInfo.endHour);
      setScheduleEndMinute("00");
      setScheduleEndAmPm(slotInfo.endAmPm);
    } else {
      setSelectedSlotKey("");
      const tmrw = DateTime.now().plus({ days: 1 }).toFormat("yyyy-MM-dd");
      setScheduleDate(tmrw);
      setScheduleStartHour("10");
      setScheduleStartMinute("00");
      setScheduleStartAmPm("AM");
      setScheduleEndHour("11");
      setScheduleEndMinute("00");
      setScheduleEndAmPm("AM");
    }

    document.getElementById("schedule-panel")?.scrollIntoView({ behavior: "smooth" });
  };

  // Create Member
  const handleAddMember = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!addEmail.trim() || !addPassword) {
      setError("Email and password are required");
      return;
    }
    setAddingMember(true);
    try {
      const tagList = addTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      
      await adminApi.createUser({
        name: addName.trim() || addEmail.trim().split("@")[0],
        email: addEmail.trim(),
        password: addPassword,
        role: addRole,
        timezone: addTimezone,
        description: addDesc.trim(),
        tags: tagList,
      });

      setSuccess(`New ${addRole.toLowerCase()} added successfully!`);
      setShowAddModal(false);
      setAddName("");
      setAddEmail("");
      setAddPassword("password123");
      setAddDesc("");
      setAddTags("");
      loadUsers();
    } catch (err) {
      setError(err.message || "Failed to create member");
    } finally {
      setAddingMember(false);
    }
  };

  // Save Edit Member
  const handleSaveMemberEdit = async (e) => {
    e.preventDefault();
    if (!editingTarget) return;
    setSavingMember(true);
    setError("");
    setSuccess("");
    try {
      const tagList = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await adminApi.updateUserMetadata(editingTarget.id, {
        name: editName,
        email: editEmail,
        role: editRole,
        timezone: editTimezone,
        description: editDesc,
        tags: tagList,
      });

      setSuccess("Member details updated successfully!");
      setEditingTarget(null);
      loadUsers();
      fetchRecommendations();
    } catch (err) {
      setError(err.message || "Failed to update member");
    } finally {
      setSavingMember(false);
    }
  };

  // Delete Member Trigger
  const handleDeleteMember = (member) => {
    setDeletingTarget(member);
  };

  // Confirm Delete Action
  const handleConfirmDeleteMember = async () => {
    if (!deletingTarget) return;
    setDeletingMember(true);
    setError("");
    setSuccess("");
    try {
      await adminApi.deleteUser(deletingTarget.id);
      setSuccess(`${deletingTarget.name} (${deletingTarget.role}) deleted successfully`);
      if (selectedUser?.id === deletingTarget.id) setSelectedUser(null);
      if (selectedMentor?.id === deletingTarget.id) setSelectedMentor(null);
      setDeletingTarget(null);
      loadUsers();
      fetchRecommendations();
    } catch (err) {
      setError(err.message || "Failed to delete member");
    } finally {
      setDeletingMember(false);
    }
  };

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
    const target = selectedUser || selectedMentor;
    if (!target || !scheduleStartIso || !scheduleEndIso) return;
    try {
      const slots = await adminApi.getOverlappingSlots(target.id, scheduleStartIso, scheduleEndIso);
      setOverlapSlots(slots);
    } catch {
      setOverlapSlots([]);
    }
  }, [selectedUser, selectedMentor, scheduleStartIso, scheduleEndIso]);

  useEffect(() => {
    if (scheduleStartIso && scheduleEndIso) checkOverlap();
  }, [scheduleStartIso, scheduleEndIso, checkOverlap]);

  const handleScheduleMeeting = async (e) => {
    e.preventDefault();
    setScheduleInlineError("");
    setSuccess("");
    if (!scheduleTitle.trim()) {
      setScheduleInlineError("Meeting title is required.");
      return;
    }
    if (!scheduleDate || !scheduleStartDt || !scheduleEndDt) {
      setScheduleInlineError("Valid start and end time required.");
      return;
    }
    if (scheduleEndDt.toMillis() <= scheduleStartDt.toMillis()) {
      setScheduleInlineError("End time must be after start time");
      return;
    }

    setLoading(true);
    try {
      const date = scheduleStartDt.toFormat("dd-MM-yyyy");
      const startTime = scheduleStartDt.toFormat("HH:mm");
      const endTime = scheduleEndDt.toFormat("HH:mm");
      const timezone = displayTimezone === "IST" ? "Asia/Kolkata" : "Europe/Dublin";
      
      const participantEmails = [userEmail.trim(), mentorEmail.trim(), ...additionalEmails.map((e) => e.trim())].filter(Boolean);

      await adminApi.scheduleMeeting({
        title: scheduleTitle.trim(),
        date,
        startTime,
        endTime,
        timezone,
        callType: selectedCallType,
        userId: selectedUser?.id,
        mentorId: selectedMentor?.id,
        participantEmails,
      });

      setSuccess("Meeting booked successfully! Both user and mentor scheduled.");
      setScheduleTitle("");
      setScheduleStartHour("");
      setScheduleStartMinute("");
      setScheduleStartAmPm("");
      setScheduleEndHour("");
      setScheduleEndMinute("");
      setScheduleEndAmPm("");
      loadMeetings();
    } catch (err) {
      setScheduleInlineError(err.message || "Failed to schedule meeting");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.tags?.some((t) => t.toLowerCase().includes(q));
    });
  }, [users, searchQuery]);

  const filteredMentors = useMemo(() => {
    return mentors.filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.tags?.some((t) => t.toLowerCase().includes(q));
    });
  }, [mentors, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-navy-900 border border-navy-700/80 rounded-2xl p-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary-500/20 text-primary-300 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-400" />
              <span>Admin Workspace</span>
            </span>
            <span className="text-slate-400 text-xs font-medium">• {authUser?.email}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-2">Mentorque Call Booking & Match Hub</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage user & mentor tags, view AI mentor recommendations, and schedule calls.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 bg-navy-950 p-1.5 rounded-xl border border-navy-800">
          <button
            onClick={() => {
              setActiveTab("recommendations");
              setSelectedUser(null);
              setSelectedMentor(null);
              setRecommendations([]);
              setSelectedSlotKey("");
              setOverlapOnlyFilter(false);
              setScheduleTitle("");
              setScheduleDate("");
              setScheduleStartHour("");
              setScheduleStartMinute("");
              setScheduleStartAmPm("");
              setScheduleEndHour("");
              setScheduleEndMinute("");
              setScheduleEndAmPm("");
              setUserEmail("");
              setMentorEmail("");
              setScheduleInlineError("");
            }}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "recommendations"
                ? "bg-primary-500 text-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Target className="w-4 h-4" />
            <span>AI Match & Book</span>
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "members"
                ? "bg-primary-500 text-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Member Settings</span>
          </button>
          <button
            onClick={() => setActiveTab("meetings")}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "meetings"
                ? "bg-primary-500 text-black"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Scheduled Calls ({meetings.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-sm font-medium bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-white font-bold">✕</button>
        </div>
      )}
      {success && (
        <div className="text-emerald-400 text-sm font-medium bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-emerald-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* TAB 1: AI RECOMMENDATION & BOOKING HUB */}
      {activeTab === "recommendations" && (
        <div className="space-y-6">

          {/* Upper Hero Panel: Step 1 - User Selection & Call Category */}
          <div className="bg-navy-900 border border-navy-700/80 rounded-2xl p-5 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-primary-400" />
                <span>1. Select User & Call Category</span>
              </h2>
              {selectedUser && (
                <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 self-start sm:self-auto">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Target User: {selectedUser.name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Target User Selection Card */}
              <div className="lg:col-span-5 space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Select a Member
                </label>

                {!selectedUser ? (
                  <button
                    type="button"
                    onClick={() => setShowUserSelectModal(true)}
                    className="w-full bg-navy-950 border border-dashed border-navy-700 hover:border-primary-500/60 hover:bg-navy-900/60 rounded-2xl p-4 text-left transition-all flex items-center justify-between group min-h-[92px] h-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/30 flex items-center justify-center font-bold">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm group-hover:text-primary-300 transition-colors">
                          Select User
                        </h4>
                        <p className="text-xs text-slate-400">
                          Click to select from {users.length} registered users
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary-400 bg-primary-500/10 border border-primary-500/30 px-3.5 py-1.5 rounded-xl group-hover:bg-primary-500 group-hover:text-black transition-all">
                      Choose User ▾
                    </span>
                  </button>
                ) : (
                  <div className="bg-navy-950 border border-emerald-500/40 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-lg min-h-[92px] h-full">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-black border border-emerald-400 font-extrabold flex items-center justify-center text-sm shrink-0">
                        {selectedUser.name
                          ? selectedUser.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                          : "U"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-white text-sm truncate">{selectedUser.name}</h4>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            SELECTED
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 font-mono truncate mt-0.5">{selectedUser.email}</p>
                        {selectedUser.tags && selectedUser.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {selectedUser.tags.slice(0, 3).map((t, i) => (
                              <span
                                key={i}
                                className="text-[10px] bg-navy-900 text-emerald-300 px-1.5 py-0.5 rounded border border-navy-700 font-medium truncate max-w-[90px]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowUserSelectModal(true)}
                      className="text-xs font-bold text-slate-300 hover:text-white bg-navy-900 hover:bg-navy-800 border border-navy-700 px-3 py-1.5 rounded-xl transition-all shrink-0"
                    >
                      Change ▾
                    </button>
                  </div>
                )}
              </div>

              {/* Call Category Requirement Pills Grid */}
              <div className="lg:col-span-7 space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Select Call Category Requirement
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {CALL_TYPES.map((ct) => {
                    const IconComp = ct.icon;
                    const isSelected = selectedCallType === ct.id;
                    return (
                      <button
                        key={ct.id}
                        type="button"
                        onClick={() => setSelectedCallType(ct.id)}
                        className={`text-left p-3.5 rounded-xl border transition-all duration-150 flex flex-col justify-between space-y-2.5 group min-h-[92px] h-full ${
                          isSelected
                            ? "bg-primary-500/10 border-primary-500/80 ring-1 ring-primary-500/40"
                            : "bg-navy-950 border-navy-800 hover:border-navy-700 hover:bg-navy-900/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 transition-colors ${
                              isSelected
                                ? "bg-primary-500 text-black border-primary-400"
                                : "bg-navy-900 text-primary-400 border-navy-700"
                            }`}
                          >
                            <IconComp className="w-3.5 h-3.5" />
                          </div>

                          {isSelected ? (
                            <span className="text-[10px] font-bold text-primary-400 flex items-center gap-1 bg-primary-500/10 border border-primary-500/30 px-2 py-0.5 rounded-md shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-500 group-hover:text-slate-300 transition-colors shrink-0">
                              Select
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-white text-xs group-hover:text-primary-300 transition-colors">
                            {ct.label}
                          </h4>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug font-medium">
                            {ct.req}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main Dual Column Section: Recommendations (Left) & Schedule Call Panel (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (7 cols): AI Recommended Mentors */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-navy-900 border border-navy-700/80 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-navy-800 pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary-400" />
                      <span>2. Recommended Mentors</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Requirement: {CALL_TYPES.find((c) => c.id === selectedCallType)?.req}
                    </p>
                  </div>

                  {/* Quick Filter Pill */}
                  <button
                      type="button"
                      onClick={() => setOverlapOnlyFilter(!overlapOnlyFilter)}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto ${
                        overlapOnlyFilter
                          ? "bg-emerald-500 text-black border-emerald-400"
                          : "bg-navy-950 text-slate-300 border-navy-700 hover:border-emerald-500/50"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{overlapOnlyFilter ? "Showing: Available Slots Only" : "Filter: Overlapping Only"}</span>
                    </button>

                  {loadingRecs && (
                    <span className="text-xs text-primary-400 animate-pulse font-medium">Matching...</span>
                  )}
                </div>

                {/* Mentor cards with left accent border */}
                <>
                  {(() => {
                    const displayedRecs = overlapOnlyFilter
                      ? recommendations.filter((r) => r.hasOverlap)
                      : recommendations;

                      if (displayedRecs.length === 0) {
                        return (
                          <div className="py-10 text-center text-slate-500 text-xs space-y-1">
                            <Sparkles className="w-7 h-7 mx-auto text-primary-400/40 mb-2" />
                            <p className="text-slate-300 font-medium">No mentors found.</p>
                            <p>{overlapOnlyFilter ? "Disable the overlap filter to see all matches." : "Select a user to load recommendations."}</p>
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {displayedRecs.map((rec, i) => {
                            const isSelected = selectedMentor?.id === rec.mentor.id;
                            return (
                              <div
                                key={rec.mentor.id}
                                className={`relative group bg-navy-950/90 border hover:border-primary-500/50 transition-all duration-200 rounded-2xl p-5 space-y-4 ${
                                  isSelected ? "border-emerald-500 bg-navy-900 shadow-lg" : "border-navy-800"
                                }`}
                              >
                                {/* Top Row: Rank Badge, Mentor Info, Match Score & Action */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-navy-800/80">
                                  <div className="flex items-start gap-3.5">
                                    {/* Mentor Avatar / Rank Icon */}
                                    <div className="relative shrink-0">
                                      <div className="w-11 h-11 rounded-xl bg-primary-500/10 text-primary-400 font-extrabold flex items-center justify-center text-sm border border-primary-500/30">
                                        {rec.mentor.name.split(" ").map((n) => n[0]).join("")}
                                      </div>
                                      <span className="absolute -top-1.5 -left-1.5 bg-primary-500 text-black text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                                        #{i + 1}
                                      </span>
                                    </div>

                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-bold text-white group-hover:text-primary-300 transition-colors">
                                          {rec.mentor.name}
                                        </h3>
                                        <span className="bg-emerald-500/15 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                          <Sparkles className="w-3 h-3 text-emerald-400" />
                                          {rec.matchScore}% Match
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                                        <span>{rec.mentor.email}</span>
                                        <span>•</span>
                                        <span className="text-slate-400 font-mono text-[11px]">{rec.mentor.timezone || "UTC"}</span>
                                      </p>
                                    </div>
                                  </div>

                                  {/* Book Call Action */}
                                  <button
                                    onClick={() => handleSelectMentorForCall(rec)}
                                    className={`font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shrink-0 ${
                                      isSelected
                                        ? "bg-primary-500 text-black"
                                        : "bg-primary-500 hover:bg-primary-400 active:bg-primary-400 text-black shadow-lg"
                                    }`}
                                  >
                                    <span>{isSelected ? "Selected ✓" : "Select & Book"}</span>
                                    <ArrowRight className="w-4 h-4 text-black" />
                                  </button>
                                </div>

                                {/* Description */}
                                {rec.mentor.description && (
                                  <p className="text-xs text-slate-300 leading-relaxed">
                                    {rec.mentor.description}
                                  </p>
                                )}

                                {/* Availability & Skills Tags Row */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Skills & Tags</span>
                                    {rec.hasOverlap ? (
                                      <span className="text-emerald-400 font-medium text-[11px] flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-emerald-400" />
                                        {rec.overlappingSlotsCount} matching time slots
                                      </span>
                                    ) : (
                                      <span className="text-amber-400/90 font-medium text-[11px] flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-amber-400" />
                                        No matching availability this week
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-1.5">
                                    {rec.mentor.tags?.map((tag, tIdx) => {
                                      const isMatched = selectedUser?.tags?.includes(tag);
                                      return (
                                        <span
                                          key={tIdx}
                                          className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${
                                            isMatched
                                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-semibold"
                                              : "bg-navy-900 text-slate-400 border-navy-800"
                                          }`}
                                        >
                                          {isMatched && <span className="mr-1 text-emerald-400 font-bold">✓</span>}
                                          {tag}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Match Reason Rationale Box */}
                                {rec.matchReasons?.length > 0 && (
                                  <div className="bg-navy-900/90 rounded-xl p-3 text-xs space-y-1.5 border border-navy-800">
                                    <div className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span>Why This Match</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                                      {rec.matchReasons.map((reason, rIdx) => (
                                        <div key={rIdx} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                          <span className="truncate" title={reason}>{sanitizeMatchReason(reason)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Time Slot Selection Modal trigger row */}
                                {rec.hasOverlap && rec.overlappingSlots?.length > 0 ? (
                                  <div className="pt-2 border-t border-navy-800/80 space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>{rec.overlappingSlots.length} Matching Time Slots</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setSlotModalRec(rec)}
                                        className="px-3.5 py-2 text-xs font-extrabold text-black bg-primary-500 hover:bg-primary-400 active:bg-primary-400 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 shrink-0"
                                      >
                                        <Calendar className="w-3.5 h-3.5 text-black" />
                                        <span>Choose a Time ➔</span>
                                      </button>
                                    </div>

                                    {/* Inline overlapping time slot chips */}
                                    {overlapOnlyFilter && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {rec.overlappingSlots.map((slot, sIdx) => {
                                          const slotInfo = getSlotDateTime(slot, weekStart);
                                          return (
                                            <span
                                              key={sIdx}
                                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium"
                                            >
                                              <Calendar className="w-3 h-3 text-emerald-400" />
                                              {slotInfo.label}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="pt-2 border-t border-navy-800/80 text-[11px] text-slate-500 italic">
                                    No matching availability this week — click Select & Book to choose a time manually.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                </>
              </div>
            </div>

            {/* Right Column (5 cols): Sticky Schedule Call Panel */}
            <div className="lg:col-span-5 sticky top-6">
              <div
                id="schedule-panel"
                className="bg-navy-900 border border-navy-700/80 rounded-2xl p-5 space-y-4 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-navy-800 pb-3">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-400" />
                    <span>3. Confirm & Book Call</span>
                  </h2>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-navy-950 px-2.5 py-1 rounded-md border border-navy-800">
                    Step 3
                  </span>
                </div>

                <form onSubmit={handleScheduleMeeting} className="space-y-4">
                  {scheduleDate && scheduleStartHour && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-300 font-semibold">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>
                          Time Slot Pre-Filled: <strong>{scheduleDate} @ {scheduleStartHour}:{scheduleStartMinute} {scheduleStartAmPm}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {scheduleInlineError && (
                    <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 p-2.5 rounded-lg">
                      {scheduleInlineError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary-400" />
                      <span>Call Title</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mock Interview: Alice x Dr. Aris"
                      value={scheduleTitle}
                      onChange={(e) => setScheduleTitle(e.target.value)}
                      className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white font-medium px-3.5 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary-400" />
                      <span>Participant Email</span>
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white font-medium px-3.5 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-primary-400" />
                      <span>Mentor Email</span>
                    </label>
                    <input
                      type="email"
                      value={mentorEmail}
                      onChange={(e) => setMentorEmail(e.target.value)}
                      className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white font-medium px-3.5 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>

                  <div>
                    <CustomDatePicker
                      label="Date"
                      value={scheduleDate}
                      onChange={(val) => setScheduleDate(val)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <CustomTimePicker
                        label="Start Time"
                        hour={scheduleStartHour}
                        minute={scheduleStartMinute}
                        ampm={scheduleStartAmPm}
                        onChange={({ hour, minute, ampm }) => {
                          if (hour) setScheduleStartHour(hour);
                          if (minute) setScheduleStartMinute(minute);
                          if (ampm) setScheduleStartAmPm(ampm);
                        }}
                      />
                    </div>

                    <div>
                      <CustomTimePicker
                        label="End Time"
                        hour={scheduleEndHour}
                        minute={scheduleEndMinute}
                        ampm={scheduleEndAmPm}
                        onChange={({ hour, minute, ampm }) => {
                          if (hour) setScheduleEndHour(hour);
                          if (minute) setScheduleEndMinute(minute);
                          if (ampm) setScheduleEndAmPm(ampm);
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary-500 hover:bg-primary-400 active:bg-primary-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-primary-500/20"
                  >
                    <Calendar className="w-4 h-4 text-black" />
                    <Clock className="w-4 h-4 text-black" />
                    <span>{loading ? "Scheduling Call..." : "Confirm & Schedule Call"}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEMBER SETTINGS & FULL MANAGEMENT */}
      {activeTab === "members" && (
        <div className="space-y-6">
          {/* Header Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-navy-900 border border-navy-700/80 rounded-2xl p-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-400" />
                <span>Member Directory & Account Settings</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage team members, including their skills, tags, and roles.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-primary-500 hover:bg-primary-400 active:bg-primary-400 text-black font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shrink-0"
            >
              <UserPlus className="w-4 h-4 text-black" />
              <span>Add New Member</span>
            </button>
          </div>

          {/* Search & Filter Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-navy-900/80 border border-navy-800 rounded-xl p-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-navy-950 border border-navy-700/80 text-white text-xs pl-9 pr-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Role:</span>
              {["ALL", "MENTOR", "USER"].map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    roleFilter === role
                      ? "bg-primary-500 text-black"
                      : "bg-navy-950 text-slate-400 hover:text-white border border-navy-800"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* ADD MEMBER MODAL FORM */}
          {showAddModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-navy-900 border border-navy-700/90 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-navy-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-400 font-bold flex items-center justify-center border border-primary-500/30">
                      <UserPlus className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Create Member Account</h3>
                      <p className="text-xs text-slate-400">Add a new Mentor or User to the workspace</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="w-8 h-8 rounded-lg bg-navy-950 text-slate-400 hover:text-white border border-navy-800 flex items-center justify-center font-bold transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleAddMember} className="space-y-4">
                  {/* Role Selector Buttons */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Account Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAddRole("MENTOR")}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          addRole === "MENTOR"
                            ? "bg-primary-500/15 text-primary-300 border-primary-500/50"
                            : "bg-navy-950 text-slate-400 border-navy-800 hover:text-white"
                        }`}
                      >
                        <Award className="w-4 h-4 text-primary-400" />
                        <span>MENTOR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddRole("USER")}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          addRole === "USER"
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/50"
                            : "bg-navy-950 text-slate-400 border-navy-800 hover:text-white"
                        }`}
                      >
                        <User className="w-4 h-4 text-emerald-400" />
                        <span>USER</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="e.g. Sarah Jenkins"
                          value={addName}
                          onChange={(e) => setAddName(e.target.value)}
                          className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs pl-8 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Email Address *</label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          placeholder="sarah@mentorque.com"
                          value={addEmail}
                          onChange={(e) => setAddEmail(e.target.value)}
                          className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs pl-8 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Password *</label>
                      <div className="relative">
                        <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showAddPassword ? "text" : "password"}
                          required
                          value={addPassword}
                          onChange={(e) => setAddPassword(e.target.value)}
                          className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs pl-8 pr-9 py-2.5 outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAddPassword(!showAddPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {showAddPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <CustomDropdown
                      label="Timezone"
                      value={addTimezone}
                      onChange={(val) => setAddTimezone(val)}
                      options={TIMEZONE_OPTIONS.map((tz) => ({
                        value: tz.id,
                        label: `${tz.label} (${tz.offset})`,
                      }))}
                      icon={Globe}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Bio / Description</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Senior Software Architect at Google. Domain expert in System Design and Mock Interviews."
                      value={addDesc}
                      onChange={(e) => setAddDesc(e.target.value)}
                      className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs p-3 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Skills & Goals Tags (Comma-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. Tech, Big company, Senior Developer, Mock Interview"
                      value={addTags}
                      onChange={(e) => setAddTags(e.target.value)}
                      className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {addTags.trim() && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {addTags.split(",").map((t) => t.trim()).filter(Boolean).map((tag, idx) => (
                          <span key={idx} className="bg-navy-950 text-slate-300 text-[11px] px-2 py-0.5 rounded-md border border-navy-700 font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-navy-800">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingMember}
                      className="bg-primary-500 hover:bg-primary-400 active:bg-primary-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all"
                    >
                      {addingMember ? "Creating..." : "Create Account"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* EDIT MEMBER MODAL FORM */}
          {editingTarget && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-navy-900 border border-navy-700/90 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-navy-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-400 font-bold flex items-center justify-center border border-primary-500/30 text-sm">
                      {editingTarget.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Edit Member: {editingTarget.name}</h3>
                      <p className="text-xs text-slate-400">Update account details, role, and skills/tags</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingTarget(null)}
                    className="w-8 h-8 rounded-lg bg-navy-950 text-slate-400 hover:text-white border border-navy-800 flex items-center justify-center font-bold transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveMemberEdit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Account Role</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditRole("MENTOR")}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          editRole === "MENTOR"
                            ? "bg-primary-500/15 text-primary-300 border-primary-500/50"
                            : "bg-navy-950 text-slate-400 border-navy-800 hover:text-white"
                        }`}
                      >
                        <Award className="w-4 h-4 text-primary-400" />
                        <span>MENTOR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRole("USER")}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          editRole === "USER"
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/50"
                            : "bg-navy-950 text-slate-400 border-navy-800 hover:text-white"
                        }`}
                      >
                        <User className="w-4 h-4 text-emerald-400" />
                        <span>USER</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  <CustomDropdown
                    label="Timezone"
                    value={editTimezone}
                    onChange={(val) => setEditTimezone(val)}
                    options={TIMEZONE_OPTIONS.map((tz) => ({
                      value: tz.id,
                      label: `${tz.label} (${tz.offset})`,
                    }))}
                    icon={Globe}
                  />

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Description / Bio</label>
                    <textarea
                      rows={3}
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs p-3 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Tags (Comma-separated)</label>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white text-xs px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {editTags.trim() && (
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {editTags.split(",").map((t) => t.trim()).filter(Boolean).map((tag, idx) => (
                          <span key={idx} className="bg-navy-950 text-slate-300 text-[11px] px-2 py-0.5 rounded-md border border-navy-700 font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-navy-800">
                    <button
                      type="button"
                      onClick={() => setEditingTarget(null)}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingMember}
                      className="bg-primary-500 hover:bg-primary-400 active:bg-primary-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all"
                    >
                      {savingMember ? "Saving Changes..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* DELETE MEMBER CONFIRMATION MODAL */}
          {deletingTarget && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-navy-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Delete Member Account?</h3>
                    <p className="text-xs text-red-400 font-medium">This action cannot be undone</p>
                  </div>
                </div>

                <div className="bg-navy-950/90 rounded-xl p-4 border border-navy-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{deletingTarget.name}</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-navy-900 text-slate-300 border-navy-700 uppercase">
                      {deletingTarget.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{deletingTarget.email}</p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-white">{deletingTarget.name}</strong>?
                  All data associated with this account, including schedules and meetings, will be removed.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-navy-800">
                  <button
                    type="button"
                    onClick={() => setDeletingTarget(null)}
                    className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteMember}
                    disabled={deletingMember}
                    className="bg-red-500 hover:bg-red-400 active:bg-red-400 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deletingMember ? "Deleting..." : "Yes, Delete Account"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}



          {/* MEMBER CARDS GRID: Users on Left, Mentors on Right */}
          {roleFilter === "ALL" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT COLUMN: USERS */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-navy-800 pb-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Users ({filteredUsers.length})</span>
                </h3>
                {filteredUsers.length === 0 ? (
                  <div className="text-slate-400 text-xs py-8 text-center bg-navy-900 border border-navy-800 rounded-xl">
                    No users found.
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="bg-navy-900 border border-navy-700/80 hover:border-navy-600 transition-all rounded-2xl p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl font-bold flex items-center justify-center text-xs border bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shrink-0">
                              {u.name ? u.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : <User className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-sm">{u.name}</h3>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                  USER
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingTarget({ ...u, role: "USER" });
                                setEditName(u.name || "");
                                setEditEmail(u.email || "");
                                setEditRole("USER");
                                setEditTimezone(u.timezone || "UTC");
                                setEditDesc(u.description || "");
                                setEditTags(u.tags?.join(", ") || "");
                              }}
                              className="p-1.5 text-slate-400 hover:text-white bg-navy-950 hover:bg-navy-800 rounded-lg border border-navy-800 transition-colors"
                              title="Edit User"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                            </button>
                            <button
                              onClick={() => handleDeleteMember({ ...u, role: "USER" })}
                              className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/30 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2">
                          {u.description || "No bio added yet."}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {u.tags?.map((tag, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 rounded-md border bg-navy-950 text-emerald-300 border-navy-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* RIGHT COLUMN: MENTORS */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-primary-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-navy-800 pb-2">
                  <Award className="w-4 h-4 text-primary-400" />
                  <span>Mentors ({filteredMentors.length})</span>
                </h3>
                {filteredMentors.length === 0 ? (
                  <div className="text-slate-400 text-xs py-8 text-center bg-navy-900 border border-navy-800 rounded-xl">
                    No mentors found.
                  </div>
                ) : (
                  filteredMentors.map((m) => (
                    <div
                      key={m.id}
                      className="bg-navy-900 border border-navy-700/80 hover:border-navy-600 transition-all rounded-2xl p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl font-bold flex items-center justify-center text-xs border bg-primary-500/10 text-primary-300 border-primary-500/30 shrink-0">
                              {m.name ? m.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : <Award className="w-4 h-4 text-primary-400" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-sm">{m.name}</h3>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-primary-500/20 text-primary-300 border-primary-500/30">
                                  MENTOR
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">{m.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingTarget({ ...m, role: "MENTOR" });
                                setEditName(m.name || "");
                                setEditEmail(m.email || "");
                                setEditRole("MENTOR");
                                setEditTimezone(m.timezone || "UTC");
                                setEditDesc(m.description || "");
                                setEditTags(m.tags?.join(", ") || "");
                              }}
                              className="p-1.5 text-slate-400 hover:text-white bg-navy-950 hover:bg-navy-800 rounded-lg border border-navy-800 transition-colors"
                              title="Edit Mentor"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                            </button>
                            <button
                              onClick={() => handleDeleteMember({ ...m, role: "MENTOR" })}
                              className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/30 transition-colors"
                              title="Delete Mentor"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2">
                          {m.description || "No description provided."}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {m.tags?.map((tag, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 rounded-md border bg-navy-950 text-primary-300 border-navy-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SINGLE ROLE FILTER: USER ONLY */}
          {roleFilter === "USER" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-navy-800 pb-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>Users ({filteredUsers.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.length === 0 ? (
                  <div className="col-span-2 text-slate-400 text-xs py-8 text-center bg-navy-900 border border-navy-800 rounded-xl">
                    No users found.
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="bg-navy-900 border border-navy-700/80 hover:border-navy-600 transition-all rounded-2xl p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl font-bold flex items-center justify-center text-xs border bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shrink-0">
                              {u.name ? u.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : <User className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-sm">{u.name}</h3>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                  USER
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">{u.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingTarget({ ...u, role: "USER" });
                                setEditName(u.name || "");
                                setEditEmail(u.email || "");
                                setEditRole("USER");
                                setEditTimezone(u.timezone || "UTC");
                                setEditDesc(u.description || "");
                                setEditTags(u.tags?.join(", ") || "");
                              }}
                              className="p-1.5 text-slate-400 hover:text-white bg-navy-950 hover:bg-navy-800 rounded-lg border border-navy-800 transition-colors"
                              title="Edit User"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                            </button>
                            <button
                              onClick={() => handleDeleteMember({ ...u, role: "USER" })}
                              className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/30 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2">
                          {u.description || "No bio added yet."}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {u.tags?.map((tag, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 rounded-md border bg-navy-950 text-emerald-300 border-navy-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* SINGLE ROLE FILTER: MENTOR ONLY */}
          {roleFilter === "MENTOR" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-primary-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-navy-800 pb-2">
                <Award className="w-4 h-4 text-primary-400" />
                <span>Mentors ({filteredMentors.length})</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMentors.length === 0 ? (
                  <div className="col-span-2 text-slate-400 text-xs py-8 text-center bg-navy-900 border border-navy-800 rounded-xl">
                    No mentors found.
                  </div>
                ) : (
                  filteredMentors.map((m) => (
                    <div
                      key={m.id}
                      className="bg-navy-900 border border-navy-700/80 hover:border-navy-600 transition-all rounded-2xl p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl font-bold flex items-center justify-center text-xs border bg-primary-500/10 text-primary-300 border-primary-500/30 shrink-0">
                              {m.name ? m.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() : <Award className="w-4 h-4 text-primary-400" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-white text-sm">{m.name}</h3>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-primary-500/20 text-primary-300 border-primary-500/30">
                                  MENTOR
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 font-mono mt-0.5">{m.email}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                setEditingTarget({ ...m, role: "MENTOR" });
                                setEditName(m.name || "");
                                setEditEmail(m.email || "");
                                setEditRole("MENTOR");
                                setEditTimezone(m.timezone || "UTC");
                                setEditDesc(m.description || "");
                                setEditTags(m.tags?.join(", ") || "");
                              }}
                              className="p-1.5 text-slate-400 hover:text-white bg-navy-950 hover:bg-navy-800 rounded-lg border border-navy-800 transition-colors"
                              title="Edit Mentor"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                            </button>
                            <button
                              onClick={() => handleDeleteMember({ ...m, role: "MENTOR" })}
                              className="p-1.5 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg border border-red-500/30 transition-colors"
                              title="Delete Mentor"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 line-clamp-2">
                          {m.description || "No description provided."}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-1">
                          {m.tags?.map((tag, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 rounded-md border bg-navy-950 text-primary-300 border-navy-700">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SCHEDULED CALLS */}
      {activeTab === "meetings" && (
        <div className="bg-navy-900 border border-navy-700/80 rounded-2xl p-6 space-y-5 shadow-xl">
          {/* Section Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-navy-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/30 flex items-center justify-center font-bold shrink-0">
                <Calendar className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white">Scheduled Mentoring Calls</h2>
                  <span className="text-[10px] font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30 px-2.5 py-0.5 rounded-full">
                    {meetings.length} Total
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Manage, view details, update schedules, or cancel booked sessions</p>
              </div>
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter calls by title, type, user..."
                value={meetingSearchQuery}
                onChange={(e) => setMeetingSearchQuery(e.target.value)}
                className="w-full rounded-xl bg-navy-950 border border-navy-700/80 text-white text-xs pl-9 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-primary-500/50"
              />
              {meetingSearchQuery && (
                <button
                  onClick={() => setMeetingSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filtered Meetings Cards List */}
          {(() => {
            const filteredMeetings = meetings.filter((m) => {
              if (!meetingSearchQuery.trim()) return true;
              const q = meetingSearchQuery.toLowerCase();
              return (
                m.title?.toLowerCase().includes(q) ||
                m.callType?.toLowerCase().includes(q) ||
                m.participants?.some(
                  (p) => p.email?.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q)
                )
              );
            });

            if (filteredMeetings.length === 0) {
              return (
                <div className="py-12 text-center text-slate-400 space-y-2 bg-navy-950/50 rounded-2xl border border-navy-800">
                  <Calendar className="w-10 h-10 text-slate-500 mx-auto opacity-40" />
                  <p className="text-sm font-semibold text-slate-300">
                    {meetingSearchQuery ? `No scheduled calls match "${meetingSearchQuery}"` : "No scheduled mentoring calls yet."}
                  </p>
                  <p className="text-xs text-slate-500">
                    Book new sessions using the AI Match tab to view them here.
                  </p>
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredMeetings.map((m) => {
                  const endDt = DateTime.fromISO(m.endTime || m.startTime);
                  const isDone = endDt.isValid && endDt.toMillis() <= Date.now();

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedViewMeeting(m)}
                      className={`border rounded-2xl p-5 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:shadow-lg overflow-hidden cursor-pointer ${
                        isDone
                          ? "bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400"
                          : "bg-navy-950 border-navy-800/80 hover:border-navy-700"
                      }`}
                    >
                      {/* Left Column: Icon, Title, Call Type, Status, Date & Time */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 border ${
                            isDone
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "bg-primary-500/10 text-primary-400 border-primary-500/30"
                          }`}
                        >
                          {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Clock className="w-5 h-5 text-primary-400" />}
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-white text-sm truncate group-hover:text-primary-300 transition-colors">
                              {m.title}
                            </h3>
                            {isDone ? (
                              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Completed
                              </span>
                            ) : (
                              <span className="bg-primary-500/15 text-primary-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-primary-500/30 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-primary-400" />
                                Scheduled
                              </span>
                            )}
                            {m.callType && (
                              <span className="bg-navy-800 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-navy-700">
                                {m.callType.replace("_", " ")}
                              </span>
                            )}
                          </div>


                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-primary-400" />
                            {DateTime.fromISO(m.startTime).toFormat("ccc, dd LLL yyyy")}
                          </span>
                          <span className="flex items-center gap-1.5 font-mono text-slate-300 bg-navy-900 border border-navy-800 px-2 py-0.5 rounded-md">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            {DateTime.fromISO(m.startTime).toFormat("hh:mm a")} – {DateTime.fromISO(m.endTime).toFormat("hh:mm a")}
                          </span>
                        </div>

                        {m.participants && m.participants.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-[11px] font-semibold text-slate-400">Participants:</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {m.participants.map((p, pIdx) => (
                                <span
                                  key={pIdx}
                                  className="text-[10px] bg-navy-900 text-slate-300 border border-navy-800 px-2 py-0.5 rounded-md font-mono"
                                >
                                  {p.name || p.email}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: View, Update, Cancel Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-navy-900">
                      <button
                        type="button"
                        onClick={() => setSelectedViewMeeting(m)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-navy-900 hover:bg-navy-800 border border-navy-700 px-3 py-1.5 rounded-xl transition-all"
                        title="View Meeting Details"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditMeeting(m)}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary-400 hover:text-white bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/30 px-3 py-1.5 rounded-xl transition-all"
                        title="Update Meeting Schedule"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-primary-400" />
                        <span>Update</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedCancelMeeting(m)}
                        className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-xl transition-all"
                        title="Cancel Meeting"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                );
              })}


              </div>
            );
          })()}
        </div>
      )}
      {/* SELECT USER MODAL DIALOG */}
      {showUserSelectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700/80 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-navy-800 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/30 flex items-center justify-center font-bold shrink-0">
                  <Users className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">Select User</h3>
                    <span className="text-[10px] font-bold bg-primary-500/20 text-primary-300 border border-primary-500/30 px-2 py-0.5 rounded-full">
                      {users.length} Available
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Choose a member to find the best mentor match</p>
                </div>
              </div>
              <button
                onClick={() => setShowUserSelectModal(false)}
                className="w-8 h-8 rounded-xl bg-navy-950 text-slate-400 hover:text-white border border-navy-800 flex items-center justify-center font-bold transition-all hover:bg-navy-800"
              >
                ✕
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, or skill..."
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  setUserModalPage(1);
                }}
                className="w-full rounded-xl bg-navy-950 border border-navy-700/80 text-white text-xs pl-10 pr-9 py-3 outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all placeholder:text-slate-500"
              />
              {userSearchQuery && (
                <button
                  onClick={() => {
                    setUserSearchQuery("");
                    setUserModalPage(1);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold bg-navy-900 w-5 h-5 rounded-full flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Users Directory Paginated List */}
            {(() => {
              const USERS_PER_PAGE = 6;
              const filteredModalUsers = users.filter((u) => {
                if (!userSearchQuery.trim()) return true;
                const q = userSearchQuery.toLowerCase();
                return (
                  u.name?.toLowerCase().includes(q) ||
                  u.email?.toLowerCase().includes(q) ||
                  u.tags?.some((t) => t.toLowerCase().includes(q))
                );
              });
              const totalPages = Math.ceil(filteredModalUsers.length / USERS_PER_PAGE) || 1;
              const currentPage = Math.min(userModalPage, totalPages);
              const startIndex = (currentPage - 1) * USERS_PER_PAGE;
              const paginatedUsers = filteredModalUsers.slice(startIndex, startIndex + USERS_PER_PAGE);

              return (
                <div className="space-y-4">
                  {filteredModalUsers.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 space-y-2 bg-navy-950/60 rounded-xl border border-navy-800">
                      <User className="w-8 h-8 text-slate-500 mx-auto opacity-50" />
                      <p className="text-xs font-semibold text-slate-300">No members match "{userSearchQuery}"</p>
                      <p className="text-[11px] text-slate-500">Try a different search term</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {paginatedUsers.map((u) => {
                          const isSelected = selectedUser?.id === u.id;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(u);
                                setShowUserSelectModal(false);
                              }}
                              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 group h-[72px] ${
                                isSelected
                                  ? "bg-emerald-500/10 border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-lg"
                                  : "bg-navy-950 border-navy-800/80 hover:border-navy-700 hover:bg-navy-900/60"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-xl font-bold text-xs flex items-center justify-center border shrink-0 transition-colors ${
                                    isSelected
                                      ? "bg-emerald-500 text-black border-emerald-400 font-extrabold shadow-sm"
                                      : "bg-navy-900 text-slate-300 border-navy-700 group-hover:border-navy-600"
                                  }`}
                                >
                                  {u.name
                                    ? u.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                                    : <User className="w-4 h-4" />}
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="font-bold text-white text-xs truncate group-hover:text-emerald-300 transition-colors">
                                      {u.name}
                                    </h4>
                                    {u.tags && u.tags.length > 0 && (
                                      <span className="text-[10px] text-slate-400 bg-navy-900 px-2 py-0.5 rounded-md border border-navy-800 shrink-0 hidden sm:inline-block font-medium">
                                        {u.tags[0]}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">{u.email}</p>
                                </div>
                              </div>

                              <div className="shrink-0">
                                {isSelected ? (
                                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Selected
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-medium text-slate-400 group-hover:text-white transition-colors border border-transparent group-hover:border-navy-700 group-hover:bg-navy-900 px-2.5 py-1 rounded-lg">
                                    Select
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Pagination Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-navy-800/80 text-xs">
                        <span className="text-slate-400 text-xs font-medium">
                          Showing <strong className="text-white">{startIndex + 1}</strong>–<strong className="text-white">{Math.min(startIndex + USERS_PER_PAGE, filteredModalUsers.length)}</strong> of <strong className="text-white">{filteredModalUsers.length}</strong> users
                        </span>

                        <div className="flex items-center gap-1.5 self-center sm:self-auto">
                          <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setUserModalPage((p) => Math.max(p - 1, 1))}
                            className="px-3 py-1.5 rounded-lg border border-navy-800 bg-navy-950 text-slate-300 hover:text-white hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
                          >
                            ◄ Prev
                          </button>

                          <div className="flex items-center gap-1 px-1">
                            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pg) => (
                              <button
                                key={pg}
                                type="button"
                                onClick={() => setUserModalPage(pg)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                  pg === currentPage
                                    ? "bg-primary-500 text-black border border-primary-400 shadow-sm"
                                    : "bg-navy-950 text-slate-400 hover:text-white border border-navy-800 hover:bg-navy-800"
                                }`}
                              >
                                {pg}
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            disabled={currentPage === totalPages}
                            onClick={() => setUserModalPage((p) => Math.min(p - 1 + 2, totalPages))}
                            className="px-3 py-1.5 rounded-lg border border-navy-800 bg-navy-950 text-slate-300 hover:text-white hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-medium"
                          >
                            Next ►
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-navy-800 pt-3.5">
              <button
                type="button"
                onClick={() => setShowUserSelectModal(false)}
                className="px-5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-navy-950 hover:bg-navy-800 border border-navy-800 rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MEETING DETAILS MODAL */}
      {selectedViewMeeting && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700/80 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Call Details</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedViewMeeting.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedViewMeeting(null)}
                className="w-8 h-8 rounded-xl bg-navy-950 text-slate-400 hover:text-white border border-navy-800 flex items-center justify-center font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Call Title
                </label>
                <div className="p-3 bg-navy-950 border border-navy-800 rounded-xl font-semibold text-sm text-white">
                  {selectedViewMeeting.title}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Call Requirement
                  </label>
                  <div className="p-2.5 bg-navy-950 border border-navy-800 rounded-xl font-bold text-xs text-emerald-400">
                    {selectedViewMeeting.callType || "General Mentoring"}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Date
                  </label>
                  <div className="p-2.5 bg-navy-950 border border-navy-800 rounded-xl font-medium text-xs text-white">
                    {DateTime.fromISO(selectedViewMeeting.startTime).toFormat("ccc, dd LLL yyyy")}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Time Slot
                </label>
                <div className="p-3 bg-navy-950 border border-navy-800 rounded-xl font-mono text-xs text-slate-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>
                    {DateTime.fromISO(selectedViewMeeting.startTime).toFormat("hh:mm a")} – {DateTime.fromISO(selectedViewMeeting.endTime).toFormat("hh:mm a")}
                  </span>
                </div>
              </div>

              {selectedViewMeeting.participants && selectedViewMeeting.participants.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Participants ({selectedViewMeeting.participants.length})
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedViewMeeting.participants.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-navy-950 border border-navy-800 rounded-xl flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-navy-900 text-slate-300 border border-navy-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {p.name ? p.name[0] : <User className="w-3.5 h-3.5" />}
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

            <div className="flex justify-end border-t border-navy-800 pt-3.5">
              <button
                type="button"
                onClick={() => setSelectedViewMeeting(null)}
                className="px-5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-navy-950 hover:bg-navy-800 border border-navy-800 rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UPDATE MEETING MODAL */}
      {selectedEditMeeting && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700/80 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-navy-800 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/30 flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Update Scheduled Call</h3>
                  <p className="text-xs text-slate-400">Modify title, call requirement, date, or time slot</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEditMeeting(null)}
                className="w-8 h-8 rounded-xl bg-navy-950 text-slate-400 hover:text-white border border-navy-800 flex items-center justify-center font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUpdateMeeting} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Call Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full rounded-xl bg-navy-950 border border-navy-700 text-white font-medium px-3.5 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Call Category Requirement</label>
                <CustomDropdown
                  value={editCallType}
                  onChange={(val) => setEditCallType(val)}
                  options={CALL_TYPE_OPTIONS}
                />
              </div>

              <div>
                <CustomDatePicker
                  label="Date"
                  value={editDate}
                  onChange={(val) => setEditDate(val)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <CustomTimePicker
                    label="Start Time"
                    hour={editStartHour}
                    minute={editStartMinute}
                    ampm={editStartAmPm}
                    onChange={({ hour, minute, ampm }) => {
                      if (hour) setEditStartHour(hour);
                      if (minute) setEditStartMinute(minute);
                      if (ampm) setEditStartAmPm(ampm);
                    }}
                  />
                </div>
                <div>
                  <CustomTimePicker
                    label="End Time"
                    hour={editEndHour}
                    minute={editEndMinute}
                    ampm={editEndAmPm}
                    onChange={({ hour, minute, ampm }) => {
                      if (hour) setEditEndHour(hour);
                      if (minute) setEditEndMinute(minute);
                      if (ampm) setEditEndAmPm(ampm);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-navy-800 pt-3.5">
                <button
                  type="button"
                  onClick={() => setSelectedEditMeeting(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-navy-950 hover:bg-navy-800 border border-navy-800 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingMeeting}
                  className="px-5 py-2 text-xs font-bold text-black bg-primary-500 hover:bg-primary-400 rounded-xl shadow-lg transition-all disabled:opacity-50"
                >
                  {updatingMeeting ? "Updating..." : "Save Changes ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MEETING CONFIRMATION MODAL */}
      {selectedCancelMeeting && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 border-b border-navy-800 pb-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Cancel Mentoring Call</h3>
                <p className="text-xs text-slate-400">This action cannot be undone</p>
              </div>
            </div>

            <div className="bg-navy-950 border border-navy-800 p-3.5 rounded-xl space-y-1.5">
              <p className="text-xs font-bold text-white">{selectedCancelMeeting.title}</p>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-primary-400" />
                {DateTime.fromISO(selectedCancelMeeting.startTime).toFormat("ccc, dd LLL yyyy 'at' hh:mm a")}
              </p>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to cancel and delete this scheduled call? All participants will be unassigned from this meeting.
            </p>

            <div className="flex items-center justify-end gap-2.5 border-t border-navy-800 pt-3.5">
              <button
                type="button"
                onClick={() => setSelectedCancelMeeting(null)}
                className="px-4 py-2 text-xs font-bold text-slate-300 hover:text-white bg-navy-950 hover:bg-navy-800 border border-navy-800 rounded-xl transition-all"
              >
                Keep Meeting
              </button>
              <button
                type="button"
                disabled={cancelingMeeting}
                onClick={handleConfirmCancelMeeting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {cancelingMeeting ? "Cancelling..." : "Cancel & Delete Call"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIME PERIOD SELECTION MODAL FOR INSTANT OVERLAP MATCH */}
      {slotModalRec && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-navy-900 border border-navy-700/80 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-navy-800 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Select Time Period</h3>
                  <p className="text-xs text-slate-400">
                    Mutually available slots for <span className="text-emerald-400 font-bold">{slotModalRec.mentor.name}</span> & <span className="text-primary-400 font-bold">{selectedUser?.name || "User"}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSlotModalRec(null)}
                className="w-8 h-8 rounded-xl bg-navy-950 text-slate-400 hover:text-white border border-navy-800 flex items-center justify-center font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Slots List / Grid */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Click a slot to pre-fill the schedule & select mentor:
              </p>
              {slotModalRec.overlappingSlots?.map((slot, sIdx) => {
                const slotInfo = getSlotDateTime(slot, weekStart);
                const key = `${slotModalRec.mentor.id}_${slot.dayOfWeek}_${slot.hour}`;
                const isChipSelected = selectedSlotKey === key;
                return (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => {
                      handleSelectMentorForCall(slotModalRec, slot);
                      setSlotModalRec(null);
                    }}
                    className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isChipSelected
                        ? "bg-emerald-500/20 border-emerald-500/50 text-white ring-1 ring-emerald-500/30"
                        : "bg-navy-950 border-navy-800 text-slate-300 hover:bg-navy-800 hover:border-emerald-500/40 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-navy-900 border border-navy-700 text-emerald-400 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{slotInfo.label}</p>
                        <p className="text-[10px] text-slate-400">{slotInfo.dateStr}</p>
                      </div>
                    </div>

                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                      isChipSelected ? "bg-emerald-500 text-black border-emerald-400" : "bg-navy-900 text-emerald-300 border-emerald-500/30"
                    }`}>
                      {isChipSelected ? "✓ Booked" : "Select Slot"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end border-t border-navy-800 pt-3.5">
              <button
                type="button"
                onClick={() => setSlotModalRec(null)}
                className="px-5 py-2 text-xs font-bold text-slate-300 hover:text-white bg-navy-950 hover:bg-navy-800 border border-navy-800 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
