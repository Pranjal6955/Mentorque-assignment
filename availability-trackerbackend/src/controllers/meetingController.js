import { prisma } from "../lib/prisma.js";
import { sendBookingNotification, getNotificationLogs } from "../services/notificationService.js";

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

    const dataToUpdate = {};
    if (title) dataToUpdate.title = title;
    if (startTime) dataToUpdate.startTime = new Date(startTime);
    if (endTime) dataToUpdate.endTime = new Date(endTime);
    if (callType) dataToUpdate.callType = callType;

    const updated = await prisma.meeting.update({
      where: { id },
      data: dataToUpdate,
      include: { participants: true },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Update meeting error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update meeting",
    });
  }
};
