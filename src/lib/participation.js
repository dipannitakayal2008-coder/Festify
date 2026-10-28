import {
  checkInDemoTicket,
  getDemoAchievements,
  getDemoRecommendations,
  issueDemoTicket,
} from "./demoData.js";

export async function makeCheckInQr(eventId, userId) {
  const ticket = issueDemoTicket(eventId, userId);
  const { default: QRCode } = await import("qrcode");
  return {
    ticket,
    image: await QRCode.toDataURL(ticket, { width: 220, margin: 2, errorCorrectionLevel: "M" }),
  };
}

export async function verifyCheckIn(rawTicket, eventId, organizerId) {
  return checkInDemoTicket(rawTicket, eventId, organizerId);
}

export async function loadAchievements(userId) {
  return getDemoAchievements(userId);
}

export async function loadRecommendations(userId) {
  return getDemoRecommendations(userId);
}

export async function downloadCertificate(participation, studentName) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFillColor(16, 15, 27);
  pdf.rect(0, 0, 297, 210, "F");
  pdf.setDrawColor(169, 139, 250);
  pdf.setLineWidth(1.2);
  pdf.roundedRect(12, 12, 273, 186, 8, 8);
  pdf.setTextColor(190, 170, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("FESTIFY - CAMPUS EVENTS", 148.5, 48, { align: "center" });
  pdf.setTextColor(248, 246, 255);
  pdf.setFontSize(29);
  pdf.text("Certificate of Participation", 148.5, 75, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.text("This certifies that", 148.5, 99, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(23);
  pdf.text(String(studentName || "Campus member"), 148.5, 116, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.text("successfully participated in", 148.5, 133, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.text(String(participation.title || "Campus event"), 148.5, 148, { align: "center", maxWidth: 240 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(190, 185, 205);
  pdf.text(`${participation.date || ""}  ·  Certificate ID: ${participation.certificateId || "pending"}`, 148.5, 171, { align: "center" });
  pdf.save(`festify-certificate-${String(participation.certificateId || "participation").replace(/[^a-z0-9-]/gi, "-")}.pdf`);
}
