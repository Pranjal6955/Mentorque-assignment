import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import { prisma } from "../lib/prisma.js";
import { getWeekStart } from "../utils/time.js";
import { loadWeeklyAvailability, isAvailableBetween } from "../services/availabilityWeek.js";
import { getMentorRecommendations } from "../services/recommendationEngine.js";
import { sendBookingNotification } from "../services/notificationService.js";
import { v4 as uuidv4 } from "uuid";
import { isPastTime } from "../utils/time.js";

export async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      select: { id: true, name: true, email: true, description: true, tags: true, timezone: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(users);
  } catch (e) {
    next(e);
  }
}

export async function listMentors(req, res, next) {
  try {
    const mentors = await prisma.user.findMany({
      where: { role: "MENTOR" },
      select: { id: true, name: true, email: true, description: true, tags: true, timezone: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json(mentors);
  } catch (e) {
    next(e);
  }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password, role, description, tags } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    if (!role || !["USER", "MENTOR"].includes(role)) {
      return res.status(400).json({ error: "Role must be USER or MENTOR" });
    }
    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const displayName = name?.trim() || email.trim().split("@")[0] || "User";
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: displayName,
        email: email.trim().toLowerCase(),
        password: hashed,
        role,
        timezone: "UTC",
        description: description?.trim() || null,
        tags: Array.isArray(tags) ? tags : [],
      },
      select: { id: true, name: true, email: true, role: true, description: true, tags: true, timezone: true, createdAt: true },
    });
    res.status(201).json(user);
  } catch (e) {
    next(e);
  }
}

export async function updateUserMetadata(req, res, next) {
  try {
    const { id } = req.params;
    const { description, tags, name, email, role, timezone } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (email && email.trim().toLowerCase() !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (existing) {
        return res.status(409).json({ error: "Email already taken" });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name != null && { name: name.trim() }),
        ...(email != null && { email: email.trim().toLowerCase() }),
        ...(role != null && ["USER", "MENTOR"].includes(role) && { role }),
        ...(timezone != null && { timezone: timezone.trim() }),
        ...(description != null && { description: description.trim() }),
        ...(Array.isArray(tags) && { tags }),
      },
      select: { id: true, name: true, email: true, role: true, description: true, tags: true, timezone: true },
    });

    res.json(updated);
  } catch (e) {
    next(e);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User or Mentor not found" });
    }

    if (user.role === "ADMIN") {
      return res.status(400).json({ error: "Cannot delete Admin account" });
    }

    // Clean up related records
    await prisma.availabilitySlot.deleteMany({
      where: { template: { OR: [{ userId: id }, { mentorId: id }] } },
    });
    await prisma.availabilityTemplate.deleteMany({
      where: { OR: [{ userId: id }, { mentorId: id }] },
    });
    await prisma.availability.deleteMany({
      where: { OR: [{ userId: id }, { mentorId: id }] },
    });
    await prisma.meetingParticipant.deleteMany({
      where: { meeting: { OR: [{ userId: id }, { mentorId: id }] } },
    });
    await prisma.meeting.deleteMany({
      where: { OR: [{ userId: id }, { mentorId: id }] },
    });

    await prisma.user.delete({ where: { id } });

    res.json({ message: `${user.role} deleted successfully` });
  } catch (e) {
    next(e);
  }
}

export async function getRecommendations(req, res, next) {
  try {
    const { userId, callType, weekStart } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "userId query parameter is required" });
    }
    const recommendations = await getMentorRecommendations({ userId, callType, weekStart });
    res.json(recommendations);
  } catch (e) {
    next(e);
  }
}

export async function getAvailabilityForUser(req, res, next) {
  try {
    const { userId } = req.params;
    const { weekStart } = req.query;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const owner =
      user.role === "MENTOR"
        ? { userId: null, mentorId: userId, role: "MENTOR" }
        : { userId, mentorId: null, role: "USER" };

    const weekStartDate = weekStart ? new Date(weekStart) : getWeekStart(new Date());
    weekStartDate.setUTCHours(0, 0, 0, 0);

    const result = await loadWeeklyAvailability(owner, weekStartDate);
    res.json(result);
  } catch (e) {
    next(e);
  }
}

export async function getOverlappingSlots(req, res, next) {
  try {
    const { userId } = req.params;
    const { startTime, endTime } = req.query;
    if (!startTime || !endTime) {
      return res.status(400).json({ error: "startTime and endTime required" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const owner =
      user.role === "MENTOR"
        ? { userId: null, mentorId: userId, role: "MENTOR" }
        : { userId, mentorId: null, role: "USER" };

    const available = await isAvailableBetween(owner, startTime, endTime);
    res.json(available ? [{ userId, startTime, endTime }] : []);
  } catch (e) {
    next(e);
  }
}

export async function scheduleMeeting(req, res, next) {
  try {
    const adminId = req.userId;
    const { title, startTime, endTime, date, timezone, participantEmails, callType, userId, mentorId } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required" });
    }

    let start;
    let end;

    if (date && timezone && typeof startTime === "string" && typeof endTime === "string" && /^\d{2}:\d{2}$/.test(startTime) && /^\d{2}:\d{2}$/.test(endTime)) {
      const startDt = DateTime.fromFormat(`${date} ${startTime}`, "dd-MM-yyyy HH:mm", { zone: timezone });
      const endDt = DateTime.fromFormat(`${date} ${endTime}`, "dd-MM-yyyy HH:mm", { zone: timezone });
      if (!startDt.isValid || !endDt.isValid) {
        return res.status(400).json({ error: "Invalid date or time. Use dd-MM-yyyy and HH:mm in the selected timezone." });
      }
      start = startDt.toJSDate();
      end = endDt.toJSDate();
    } else if (startTime && endTime) {
      start = new Date(startTime);
      end = new Date(endTime);
    } else {
      return res.status(400).json({ error: "startTime and endTime are required (or date, startTime, endTime, timezone)." });
    }

    if (start >= end) {
      return res.status(400).json({ error: "endTime must be after startTime" });
    }

    const emails = Array.isArray(participantEmails)
      ? participantEmails.map((e) => (typeof e === "string" ? e.trim() : "")).filter(Boolean)
      : [];

    const meeting = await prisma.meeting.create({
      data: {
        id: uuidv4(),
        adminId,
        userId: userId || null,
        mentorId: mentorId || null,
        title: title.trim(),
        callType: callType || null,
        startTime: start,
        endTime: end,
      },
    });

    if (emails.length > 0) {
      await prisma.meetingParticipant.createMany({
        data: emails.map((email) => ({
          id: uuidv4(),
          meetingId: meeting.id,
          email,
        })),
        skipDuplicates: true,
      });
    }

    const withParticipants = await prisma.meeting.findUnique({
      where: { id: meeting.id },
      include: { participants: true, user: true, mentor: true },
    });

    // Trigger Email & Webhook notification
    sendBookingNotification({ meetingId: meeting.id, eventType: "MEETING_BOOKED" }).catch((err) => {
      console.error("Failed to send booking notification:", err);
    });

    res.status(201).json(withParticipants);
  } catch (e) {
    next(e);
  }
}
