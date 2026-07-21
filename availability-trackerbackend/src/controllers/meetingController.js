import { prisma } from "../lib/prisma.js";
import { sendBookingNotification, getNotificationLogs } from "../services/notificationService.js";
import { isAvailableBetween } from "../services/availabilityWeek.js";

export async function listMeetings(req, res, next) {
  try {
    const { userId, mentorId, adminId, from, to } = req.query;
    const where = {};

    if (req.userRole === "USER") {
      if (userId) where.userId = userId;
      else if (mentorId) where.mentorId = mentorId;
      else where.OR = [{ userId: req.userId }, { mentorId: req.userId }];
    } else if (req.userRole === "MENTOR") {
      if (mentorId) where.mentorId = mentorId;
      else if (userId) where.userId = userId;
      else where.OR = [{ mentorId: req.userId }, { userId: req.userId }];
    } else {
      if (userId) where.userId = userId;
      else if (mentorId) where.mentorId = mentorId;
      else if (adminId) where.adminId = adminId;
    }


    if (from) where.startTime = { ...where.startTime, gte: new Date(from) };
    if (to) where.endTime = { ...where.endTime, lte: new Date(to) };

    const meetings = await prisma.meeting.findMany({
      where,
      include: { participants: true, user: true, mentor: true },
      orderBy: { startTime: "asc" },
    });
    res.json(meetings);
  } catch (e) {
    next(e);
  }
}


export const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    // Trigger cancellation email & webhook before deletion
    await sendBookingNotification({ meetingId: id, eventType: "MEETING_CANCELLED" }).catch((err) => {
      console.error("Failed to send cancellation notification:", err);
    });

    await prisma.meeting.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Meeting deleted successfully and cancellation notifications sent",
    });
  } catch (error) {
    console.error("Delete meeting error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete meeting",
    });
  }
};

export const getNotifications = async (req, res) => {
  try {
    const logs = getNotificationLogs();
    if (req.userRole === "ADMIN") {
      return res.json({ success: true, logs });
    }
    const userEmail = req.userEmail?.toLowerCase();
    const userLogs = logs.filter((l) =>
      (l.recipients || []).some((r) => r.toLowerCase() === userEmail)
    );
    res.json({ success: true, logs: userLogs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};



export const updateMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, startTime, endTime, callType } = req.body;

    const existingMeeting = await prisma.meeting.findUnique({
      where: { id },
      include: { user: true, mentor: true },
    });
    if (!existingMeeting) {
      return res.status(404).json({ success: false, message: "Meeting not found" });
    }

    const start = startTime ? new Date(startTime) : existingMeeting.startTime;
    const end = endTime ? new Date(endTime) : existingMeeting.endTime;

    if (start >= end) {
      return res.status(400).json({ success: false, message: "endTime must be after startTime" });
    }

    if (startTime || endTime) {
      if (existingMeeting.userId) {
        const userOwner = { userId: existingMeeting.userId, mentorId: null, role: "USER" };
        const userAvailable = await isAvailableBetween(userOwner, start, end);
        if (!userAvailable) {
          return res.status(400).json({
            success: false,
            message: `User "${existingMeeting.user?.name || "User"}" is NOT available at the selected time slot.`,
          });
        }

        const userOverlap = await prisma.meeting.findFirst({
          where: {
            id: { not: id },
            OR: [
              { userId: existingMeeting.userId },
              { mentorId: existingMeeting.userId },
              ...(existingMeeting.user?.email ? [{ participants: { some: { email: existingMeeting.user.email } } }] : []),
            ],
            startTime: { lt: end },
            endTime: { gt: start },
          },
        });
        if (userOverlap) {
          return res.status(400).json({
            success: false,
            message: `User "${existingMeeting.user?.name || "User"}" already has another meeting ("${userOverlap.title}") scheduled at this time.`,
          });
        }
      }

      if (existingMeeting.mentorId) {
        const mentorOwner = { userId: null, mentorId: existingMeeting.mentorId, role: "MENTOR" };
        const mentorAvailable = await isAvailableBetween(mentorOwner, start, end);
        if (!mentorAvailable) {
          return res.status(400).json({
            success: false,
            message: `Mentor "${existingMeeting.mentor?.name || "Mentor"}" is NOT available at the selected time slot.`,
          });
        }

        const mentorOverlap = await prisma.meeting.findFirst({
          where: {
            id: { not: id },
            OR: [
              { mentorId: existingMeeting.mentorId },
              { userId: existingMeeting.mentorId },
              ...(existingMeeting.mentor?.email ? [{ participants: { some: { email: existingMeeting.mentor.email } } }] : []),
            ],
            startTime: { lt: end },
            endTime: { gt: start },
          },
        });
        if (mentorOverlap) {
          return res.status(400).json({
            success: false,
            message: `Mentor "${existingMeeting.mentor?.name || "Mentor"}" already has another meeting ("${mentorOverlap.title}") scheduled at this time.`,
          });
        }
      }
    }

    const dataToUpdate = {};
    if (title) dataToUpdate.title = title;
    if (startTime) dataToUpdate.startTime = start;
    if (endTime) dataToUpdate.endTime = end;
    if (callType) dataToUpdate.callType = callType;

    const updated = await prisma.meeting.update({
      where: { id },
      data: dataToUpdate,
      include: { participants: true, user: true, mentor: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update meeting error:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update meeting",
    });
  }
};
