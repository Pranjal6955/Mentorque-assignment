import { prisma } from "../lib/prisma.js";

// In-memory store of recent notification audit logs
const notificationLogs = [];

/**
 * Send Webhook payload if WEBHOOK_URL environment variable is set
 */
async function triggerWebhook(event, payload) {
  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Mentorque-Event": event,
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });
    console.log(`[Notification Webhook] Sent event '${event}' to ${webhookUrl} - Status: ${res.status}`);
  } catch (err) {
    console.error(`[Notification Webhook Error] Failed to send event '${event}':`, err.message);
  }
}

/**
 * Send email notification (Logs structured email & optionally dispatches webhook)
 */
export async function sendBookingNotification({ meetingId, eventType }) {
  try {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
        admin: { select: { id: true, name: true, email: true } },
        participants: true,
      },
    });

    if (!meeting && eventType !== "MEETING_CANCELLED") return;

    const recipients = new Set();
    if (meeting?.user?.email) recipients.add(meeting.user.email);
    if (meeting?.mentor?.email) recipients.add(meeting.mentor.email);
    if (meeting?.admin?.email) recipients.add(meeting.admin.email);
    (meeting?.participants || []).forEach((p) => {
      if (p.email) recipients.add(p.email);
    });

    const recipientList = Array.from(recipients);

    const isBooking = eventType === "MEETING_BOOKED";
    const subject = isBooking
      ? `📅 [Confirmed] Mentoring Call: ${meeting?.title || "Session"}`
      : `❌ [Cancelled] Mentoring Call Session`;

    const body = isBooking
      ? `Hi there,\n\nYour mentoring session "${meeting.title}" has been successfully scheduled!\n\nCall Type: ${meeting.callType || "General Mentoring"}\nStart Time: ${meeting.startTime.toISOString()}\nEnd Time: ${meeting.endTime.toISOString()}\nUser: ${meeting.user?.name || "N/A"}\nMentor: ${meeting.mentor?.name || "N/A"}\n\nThank you,\nMentorque Team`
      : `Hi there,\n\nA scheduled mentoring call has been cancelled by the Administrator.\n\nThank you,\nMentorque Team`;

    const logEntry = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      meetingId,
      eventType,
      recipients: recipientList,
      subject,
      timestamp: new Date().toISOString(),
      status: "DELIVERED",
    };

    notificationLogs.unshift(logEntry);
    if (notificationLogs.length > 50) notificationLogs.pop();

    console.log(`\n================ ✉️ EMAIL NOTIFICATION (${eventType}) ================`);
    console.log(`TO: ${recipientList.join(", ")}`);
    console.log(`SUBJECT: ${subject}`);
    console.log(`BODY:\n${body}`);
    console.log(`========================================================================\n`);

    // Dispatch webhook trigger
    await triggerWebhook(isBooking ? "meeting.booked" : "meeting.cancelled", {
      meetingId,
      title: meeting?.title,
      callType: meeting?.callType,
      startTime: meeting?.startTime,
      endTime: meeting?.endTime,
      user: meeting?.user,
      mentor: meeting?.mentor,
      recipients: recipientList,
    });

    return logEntry;
  } catch (error) {
    console.error(`[Notification Error] Failed to process ${eventType}:`, error);
  }
}

/**
 * Get recent notification logs
 */
export function getNotificationLogs() {
  return notificationLogs;
}
