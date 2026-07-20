import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import * as availabilityApi from "../api/availability";
import {
  getViewWeekDates,
  formatDateLocal,
  formatTimeLocal,
  formatTimeRange,
  slotToUTC,
  isSlotInPast,
} from "../utils/time";
import MqSelect from "./MqSelect";

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
  const [loading, setLoading] = useState(!user);
  const [saving, setSaving] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [toggles, setToggles] = useState({});
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

  useEffect(() => {
    setToggles({});
  }, [weekOffset, viewAs?.userId, viewAs?.mentorId]);

  useEffect(() => {
    if (user) fetchWeekly();
  }, [fetchWeekly]);

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
        <SaveScopeModal
          open={saveModalOpen}
          saving={saving}
          onClose={() => !saving && setSaveModalOpen(false)}
          onChoose={commitSave}
          forOther={Boolean(viewAs)}
        />
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

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      <section className="mq-card overflow-hidden">
        <div className="grid grid-cols-1 gap-4 border-b border-white/[0.06] px-5 py-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="min-w-0 lg:col-start-1">
            <h2 className="text-sm font-semibold text-ink-50">Weekly grid</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              {readOnly
                ? "Weekly availability grid. Navigate weeks to inspect past or upcoming schedules."
                : "Click or drag to toggle. Day/time labels select a full row or column."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 justify-self-center lg:col-start-2">
            <button
              type="button"
              onClick={prevWeek}
              disabled={!readOnly && weekOffset === 0}
              className="mq-btn-icon"
              aria-label="Previous week"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[10rem] text-center text-sm font-medium text-ink-400">
              {formatDateLocal(gridStart, displayTimezone)}
              <span className="mx-1.5 text-ink-600">–</span>
              {formatDateLocal(gridDates[6], displayTimezone)}
            </span>
            <button type="button" onClick={nextWeek} className="mq-btn-icon" aria-label="Next week">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-self-center lg:col-start-3 lg:justify-self-end">
            {!readOnly && (
              <>
                <button type="button" onClick={cancelChanges} disabled={!hasChanges} className="mq-btn-secondary">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveClick}
                  disabled={saving || !hasChanges}
                  className="mq-btn-primary"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mq-scroll max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="p-16 text-center text-sm text-ink-500">Loading…</div>
          ) : (
            <table className="w-full table-fixed border-collapse select-none">
              <colgroup>
                <col style={{ width: "11rem" }} />
                {gridDates.map((d) => (
                  <col key={d} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-navy-800/80 backdrop-blur-md">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-ink-500 whitespace-nowrap">
                    Time
                  </th>
                  {gridDates.map((d) => {
                    const colActive = isColumnAllEnabled(d);
                    const colActionable = hasActionableColumn(d);
                    return (
                      <th key={d} className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => !readOnly && toggleColumn(d)}
                          disabled={readOnly || !colActionable}
                          title={!readOnly && colActionable ? "Toggle all slots this day" : undefined}
                          className={`
                            w-full rounded-md px-1 py-1.5 text-xs font-semibold transition
                            ${!colActionable
                              ? "cursor-not-allowed text-ink-600"
                              : "cursor-pointer hover:bg-white/[0.04]"}
                            ${colActionable && colActive ? "text-ink-50" : ""}
                            ${colActionable && !colActive ? "text-ink-50" : ""}
                          `}
                        >
                          {formatDateLocal(d, displayTimezone)}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {HOURS.map((hour) => {
                  const rowActive = isRowAllEnabled(hour);
                  const rowActionable = hasActionableRow(hour);
                  return (
                    <tr key={hour}>
                      <td className="px-1 py-1 align-middle">
                        <button
                          type="button"
                          onClick={() => !readOnly && toggleRow(hour)}
                          disabled={readOnly || !rowActionable}
                          title={!readOnly && rowActionable ? "Toggle all slots this hour" : undefined}
                          className={`
                            w-full rounded-md px-2 py-1.5 text-left text-xs font-medium whitespace-nowrap transition
                            ${!rowActionable
                              ? "cursor-not-allowed text-ink-600"
                              : "cursor-pointer hover:bg-white/[0.04]"}
                            ${rowActionable && rowActive ? "text-ink-50" : ""}
                            ${rowActionable && !rowActive ? "text-ink-400" : ""}
                          `}
                        >
                          {formatTimeOptionLabel(hour)}
                        </button>
                      </td>
                      {gridDates.map((dateStr) => {
                        const enabled = isSlotEnabled(dateStr, hour);
                        const disabled = isSlotDisabled(dateStr, hour);
                        return (
                          <td key={dateStr} className="p-0.5 align-middle">
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
                                mq-slot
                                ${!disabled && !readOnly ? "cursor-pointer" : ""}
                                ${disabled ? "mq-slot-past cursor-not-allowed" : ""}
                                ${readOnly && !disabled ? "cursor-default" : ""}
                                ${!disabled && enabled ? "mq-slot-on" : ""}
                                ${!disabled && !enabled ? "mq-slot-off" : ""}
                              `}
                            >
                              {!disabled && enabled && (
                                <span className="mq-slot-check" aria-hidden>
                                  <svg
                                    className="h-2 w-2 text-white/85"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
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
