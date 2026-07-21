import { get, put, del } from "./client.js";

export async function listMeetings(params = {}) {
  const q = new URLSearchParams(params).toString();
  return get(`/api/meetings${q ? `?${q}` : ""}`);
}

export async function updateMeeting(meetingId, data) {
  return put(`/api/meetings/${meetingId}`, data);
}

export async function deleteMeeting(meetingId) {
  return del(`/api/meetings/${meetingId}`);
}

export async function getNotifications() {
  return get("/api/meetings/notifications");
}

