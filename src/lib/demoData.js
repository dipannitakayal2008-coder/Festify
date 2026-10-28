const day = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const demoEvents = [
  {
    id: "demo-event-tech-night",
    title: "Campus Tech Night",
    description: "Meet student builders, explore creative projects, and connect over an evening of ideas.",
    category: "Technology",
    date: day(5),
    time: "18:00",
    endTime: "20:00",
    venue: "Innovation Hub",
    venueLocation: "Innovation Hub, Building A, Room 204",
    capacity: 120,
    status: "approved",
    ownerId: "demo-organizer",
    venueMapUrl: "",
    venueMapPinX: 50,
    venueMapPinY: 50,
  },
  {
    id: "demo-event-spring-social",
    title: "Campus Social",
    description: "Good music, new friends, and a relaxed evening for the whole campus.",
    category: "Community",
    date: day(9),
    time: "17:30",
    endTime: "20:00",
    venue: "Central Courtyard",
    venueLocation: "Central Courtyard, east campus entrance",
    capacity: 200,
    status: "published",
    ownerId: "demo-organizer",
    venueMapUrl: "",
    venueMapPinX: 50,
    venueMapPinY: 50,
  },
  {
    id: "demo-event-art-market",
    title: "Student Art Market",
    description: "Discover prints, handmade work, and creative workshops from campus artists.",
    category: "Arts",
    date: day(13),
    time: "12:00",
    endTime: "16:00",
    venue: "Student Union",
    venueLocation: "Student Union, 1st floor",
    capacity: 80,
    status: "pending",
    ownerId: "demo-organizer",
    venueMapUrl: "",
    venueMapPinX: 50,
    venueMapPinY: 50,
  },
  {
    id: "demo-event-hack-for-good",
    title: "Hack for Good: Campus Impact Hackathon",
    description: "A 24-hour hackathon where teams build practical technology for accessibility, student wellbeing, and community needs.",
    category: "Hackathon",
    date: day(18),
    time: "09:00",
    endTime: "18:00",
    venue: "Innovation Hub, Main Lab",
    venueLocation: "Innovation Hub, Building A, Main Lab",
    capacity: 100,
    status: "pending",
    ownerId: "demo-organizer",
    venueMapUrl: "",
    venueMapPinX: 50,
    venueMapPinY: 50,
  },
  {
    id: "demo-event-ai-hackathon",
    title: "AI for Everyone Hackathon",
    description: "Design responsible AI prototypes for real campus challenges in this beginner-friendly team hackathon.",
    category: "Hackathon",
    date: day(24),
    time: "10:00",
    endTime: "17:00",
    venue: "Engineering Block, Lab 3",
    venueLocation: "Engineering Block, second floor, Lab 3",
    capacity: 80,
    status: "pending",
    ownerId: "demo-organizer",
    venueMapUrl: "",
    venueMapPinX: 50,
    venueMapPinY: 50,
  },
  {
    id: "demo-event-green-tech",
    title: "Green Campus Innovation Challenge",
    description: "Pitch and prototype ideas to reduce campus waste, save energy, and make shared spaces more sustainable.",
    category: "Sustainability",
    date: day(29),
    time: "11:00",
    endTime: "16:00",
    venue: "Student Union, Conference Hall",
    venueLocation: "Student Union, first floor, Conference Hall",
    capacity: 90,
    status: "pending",
    ownerId: "demo-organizer",
    venueMapUrl: "",
    venueMapPinX: 50,
    venueMapPinY: 50,
  },
  {
    id: "demo-event-robotics-sprint",
    title: "Inter-College Robotics Hackathon",
    description: "Build, test, and demonstrate a working robotics prototype with student teams from across the region.",
    category: "Hackathon",
    date: day(35),
    time: "09:30",
    endTime: "18:30",
    venue: "Robotics Lab, Technology Center",
    venueLocation: "Technology Center, ground floor, Robotics Lab",
    capacity: 72,
    status: "pending",
    ownerId: "demo-organizer",
    venueMapUrl: "",
    venueMapPinX: 50,
    venueMapPinY: 50,
  },
  {
    id: "demo-event-cultural-night",
    title: "One Campus, Many Cultures",
    description: "A student-led evening of live performances, food stalls, and cultural showcases from across campus.",
    category: "Cultural",
    date: day(40),
    time: "16:00",
    endTime: "20:00",
    venue: "Central Courtyard",
    venueLocation: "Central Courtyard, east campus entrance",
    capacity: 250,
    status: "pending",
    ownerId: "demo-organizer",
    venueMapUrl: "",
    venueMapPinX: 50,
    venueMapPinY: 50,
  },
];

const demoRegistrations = [
  { event_id: "demo-event-past-tech", status: "attended", userId: "demo-student" },
];
const demoAttendances = [
  {
    eventId: "demo-event-past-tech",
    userId: "demo-student",
    stars: 3,
    certificateId: "FESTIFY-CERT-2026-001",
    category: "Technology",
    title: "Campus Innovation Showcase",
    date: day(-12),
  },
];
const demoTickets = new Map();

export function getDemoAchievements(userId) {
  const attended = demoAttendances.filter((item) => item.userId === userId);
  return {
    stars: attended.reduce((total, item) => total + item.stars, 0),
    participations: attended,
  };
}

export function getDemoRecommendations(userId) {
  const history = demoAttendances.filter((item) => item.userId === userId);
  const counts = new Map();
  for (const item of history) counts.set(item.category, (counts.get(item.category) || 0) + 1);
  const categories = [...counts.keys()].sort((first, second) => counts.get(second) - counts.get(first));
  const recommendations = categories.map((category) => ({
    category,
    reason: `You have participated in ${counts.get(category)} ${category} ${counts.get(category) === 1 ? "event" : "events"}.`,
    events: demoEvents.filter((event) =>
      ["approved", "published"].includes(event.status) && event.category === category
    ),
  })).filter((item) => item.events.length > 0);
  return {
    source: "Personalized picks",
    recommendations,
  };
}

export function issueDemoTicket(eventId, userId) {
  const registered = demoRegistrations.some(
    (item) => item.event_id === eventId && item.userId === userId && item.status !== "attended"
  );
  if (!registered) throw new Error("Register for this event before requesting a check-in QR code.");
  const token = crypto.randomUUID();
  const ticket = {
    type: "festify-ticket",
    token,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  demoTickets.set(token, { ...ticket, eventId, studentId: userId });
  return JSON.stringify({ type: ticket.type, token });
}

export function checkInDemoTicket(rawTicket, eventId, organizerId) {
  let ticket;
  try {
    ticket = JSON.parse(rawTicket);
  } catch {
    throw new Error("That QR code is not a valid Festify check-in ticket.");
  }
  const storedTicket = demoTickets.get(ticket?.token);
  if (
    organizerId !== "demo-organizer" ||
    ticket?.type !== "festify-ticket" ||
    !storedTicket ||
    storedTicket.eventId !== eventId ||
    ticket.eventId && ticket.eventId !== eventId ||
    storedTicket.expiresAt <= Date.now() ||
    ticket.studentId && storedTicket.studentId !== ticket.studentId
  ) {
    throw new Error("This QR code is invalid, expired, or for another event.");
  }
  const existing = demoAttendances.find(
    (item) => item.eventId === eventId && item.userId === storedTicket.studentId
  );
  if (existing) throw new Error("This student has already checked in to this event.");

  const event = demoEvents.find((item) => item.id === eventId);
  const registration = demoRegistrations.find(
    (item) => item.event_id === eventId && item.userId === storedTicket.studentId
  );
  if (!event || !registration || !["approved", "published"].includes(event.status)) {
    throw new Error("The student must be registered for this approved event to check in.");
  }

  const certificateId = `FESTIFY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const attendance = {
    eventId,
    userId: storedTicket.studentId,
    stars: 3,
    certificateId,
    category: event.category,
    title: event.title,
    date: event.date,
  };
  demoAttendances.push(attendance);
  registration.status = "attended";
  demoTickets.delete(ticket.token);
  return attendance;
}

export function isDemoEvent(id) {
  return String(id).startsWith("demo-event-");
}

export function getDemoDashboardData(role, userId) {
  const allEvents = demoEvents.filter((event) =>
    role === "organizer" ? event.ownerId === userId : true
  );
  const events = role === "student"
    ? allEvents.filter((event) => ["approved", "published"].includes(event.status))
    : allEvents;
  const participantCounts = {};
  if (role === "organizer") {
    for (const event of events) {
      participantCounts[event.id] = new Set(
        demoRegistrations
          .filter((registration) =>
            registration.event_id === event.id &&
            ["registered", "confirmed", "attended"].includes(String(registration.status).toLowerCase())
          )
          .map((registration) => registration.userId)
          .filter(Boolean)
      ).size;
    }
  }

  return {
    events,
    participantCounts,
    pendingEvents: role === "admin"
      ? allEvents.filter((event) => ["pending", "submitted", "in_review"].includes(event.status))
      : [],
    registrations: role === "student"
      ? demoRegistrations.filter((registration) => registration.userId === userId && registration.status !== "attended")
      : [],
  };
}

export function registerDemoForEvent(eventId, userId = "demo-student") {
  const event = demoEvents.find((item) => item.id === eventId);
  if (!event || !["approved", "published"].includes(event.status)) {
    throw new Error("This event is not open for registration.");
  }
  if (demoRegistrations.some((registration) => registration.event_id === eventId && registration.userId === userId)) {
    return { data: { status: "already registered" }, status: "already registered" };
  }
  demoRegistrations.push({ event_id: eventId, status: "registered", userId });
  return { data: { status: "registered" }, status: "registered" };
}

export function saveDemoEvent(values, userId, existingEvent) {
  if (userId !== "demo-organizer") throw new Error("Only the organizer can manage these events.");
  if (existingEvent) {
    const event = demoEvents.find((item) => item.id === existingEvent.id);
    if (!event) throw new Error("The event could not be found.");
    Object.assign(event, values);
    return event;
  }

  const event = {
    ...values,
    id: `demo-event-${crypto.randomUUID()}`,
    status: "pending",
    ownerId: userId,
    venueMapUrl: values.venueMapUrl || "",
    venueMapPinX: Number.isFinite(Number(values.venueMapPinX)) ? Number(values.venueMapPinX) : 50,
    venueMapPinY: Number.isFinite(Number(values.venueMapPinY)) ? Number(values.venueMapPinY) : 50,
  };
  demoEvents.push(event);
  return event;
}

export function reviewDemoEvent(event, decision) {
  const current = demoEvents.find((item) => item.id === event.id);
  if (!current || current.status !== "pending" || !["approved", "rejected"].includes(decision)) {
    throw new Error("This submission can no longer be reviewed.");
  }
  current.status = decision;
  return current;
}
