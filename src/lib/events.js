import { supabase } from "./supabaseClient.js";

const field = (row, names, fallback = "") => {
  for (const name of names) {
    if (row?.[name] !== undefined && row[name] !== null) return row[name];
  }
  return fallback;
};

export function normalizeEvent(row) {
  return {
    id: field(row, ["id", "event_id"]),
    title: field(row, ["title", "name", "event_name"], "Untitled event"),
    description: field(row, ["description", "details", "summary"]),
    category: field(row, ["category", "event_category", "type"], "Campus"),
    date: field(row, ["event_date", "date", "start_date"]),
    time: field(row, ["time", "event_time", "start_time"]),
    venue: field(row, ["venue", "venue_name", "location"], "Venue to be announced"),
    capacity: field(row, ["capacity", "max_participants"]),
    status: field(row, ["status", "approval_status"]),
    ownerId: field(row, ["organizer_id", "created_by", "user_id", "owner_id"]),
    raw: row,
  };
}

function assertClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Add the project URL and publishable key to the root .env.local file.");
  }
}

function isApproved(event) {
  return ["approved", "published"].includes(String(event.status).toLowerCase());
}

function isPending(event) {
  return ["pending", "submitted", "in_review"].includes(String(event.status).toLowerCase());
}

function userOwnsEvent(event, userId) {
  return Boolean(event.ownerId) && String(event.ownerId) === String(userId);
}

export async function fetchDashboardData(role, userId) {
  assertClient();
  const { data: rows, error } = await supabase.from("events").select("*");
  if (error) throw error;

  const allEvents = (rows || []).map(normalizeEvent);
  let events = allEvents;
  if (role === "student") events = allEvents.filter(isApproved);
  if (role === "organizer") events = allEvents.filter((event) => userOwnsEvent(event, userId));
  if (role === "admin") events = allEvents;

  let registrations = [];
  if (role === "student") {
    const { data, error: registrationsError } = await supabase
      .from("registrations")
      .select("*");
    if (registrationsError) throw registrationsError;
    registrations = data || [];
  }

  return {
    events,
    pendingEvents: role === "admin" ? allEvents.filter(isPending) : [],
    registrations,
  };
}

export async function registerForEvent(eventId) {
  assertClient();
  const { data, error } = await supabase.rpc("register_for_event", {
    p_event_id: eventId,
  });
  if (error) throw error;

  const response = Array.isArray(data) ? data[0] : data;
  const status = typeof response === "string"
    ? response
    : field(response, [
      "status",
      "registration_status",
      "waitlist_status",
      "result",
      "message",
    ]);

  return { data, status: String(status || "").trim() };
}

const eventColumns = {
  title: ["title", "name", "event_name"],
  description: ["description", "details", "summary"],
  category: ["category", "event_category", "type"],
  date: ["event_date", "date", "start_date"],
  venue: ["venue", "venue_name", "location"],
  capacity: ["capacity", "max_participants"],
};

function eventPayload(values, row = null) {
  const payload = {};
  for (const [valueName, candidates] of Object.entries(eventColumns)) {
    if (valueName === "capacity" && values[valueName] === "") continue;
    const column = row
      ? candidates.find((candidate) => Object.hasOwn(row, candidate))
      : candidates[0];
    if (column) payload[column] = values[valueName];
  }
  return payload;
}

export async function saveOrganizerEvent(values, userId, existingEvent = null) {
  assertClient();
  const payload = eventPayload(values, existingEvent?.raw);

  if (existingEvent) {
    if (!existingEvent.raw?.id) throw new Error("This event is missing its database id and cannot be updated.");
    const { data, error } = await supabase
      .from("events")
      .update(payload)
      .eq("id", existingEvent.raw.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No event was updated. Check that you still have permission to edit this event.");
    return normalizeEvent(data);
  }

  payload.organizer_id = userId;
  payload.status = "pending";
  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return normalizeEvent(data);
}

export async function reviewEvent(event, decision) {
  assertClient();
  if (!event.raw?.id) throw new Error("This event is missing its database id and cannot be reviewed.");
  const statusColumn = Object.hasOwn(event.raw, "status") ? "status" : "approval_status";
  const currentStatus = String(event.raw[statusColumn] || "");
  const nextStatus = currentStatus && currentStatus !== currentStatus.toLowerCase()
    ? decision[0].toUpperCase() + decision.slice(1)
    : decision.toLowerCase();

  const { data, error } = await supabase
    .from("events")
    .update({ [statusColumn]: nextStatus })
    .eq("id", event.raw.id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No event was updated. Check your administrator role and the event approval policy.");
  return normalizeEvent(data);
}

export function registrationEventId(row) {
  return field(row, ["event_id", "eventId", "p_event_id"]);
}

export function registrationStatus(row) {
  return field(row, ["status", "registration_status", "waitlist_status", "state"]);
}

export function eventIsPending(event) {
  return isPending(event);
}
