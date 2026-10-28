const demoAccounts = [
  { id: "DEMO-STUDENT-001", name: "Demo Student", role: "student", password: "FestifyDemo2026!" },
  { id: "DEMO-ORGANIZER-001", name: "Demo Organizer", role: "organizer", password: "FestifyDemo2026!" },
  { id: "DEMO-ADMIN-001", name: "Demo Admin", role: "admin", password: "FestifyDemo2026!" },
];

export function signInDemo(studentId, password, expectedRole) {
  const account = demoAccounts.find(
    (candidate) =>
      candidate.id === studentId.trim().toUpperCase() &&
      candidate.password === password &&
      candidate.role === expectedRole
  );
  if (!account) return null;

  return {
    access_token: `demo-access-${account.role}`,
    refresh_token: `demo-refresh-${account.role}`,
    user: {
      id: `demo-${account.role}`,
      app_metadata: { demo: true, role: account.role },
      user_metadata: { full_name: account.name, student_id: account.id },
    },
  };
}

export function isDemoUser(user) {
  return import.meta.env.DEV && user?.app_metadata?.demo === true;
}
