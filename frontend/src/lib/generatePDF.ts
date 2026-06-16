/**
 * generatePDF — Creates a styled PDF of the hardened LexAI document using jsPDF.
 * Call this from the frontend instead of the plain-text download.
 */
export async function generatePDF(
  taskId: string,
  documentText: string,
  result: {
    initial_score: number;
    final_score: number;
    rounds: number;
    document_type?: string;
    summary?: string;
  }
): Promise<void> {
  // Dynamically import so it doesn't bloat the initial bundle
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Helpers ────────────────────────────────────────────────────────────────

  const checkPage = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addText = (
    text: string,
    size: number,
    color: [number, number, number],
    opts: {
      bold?: boolean;
      align?: "left" | "center" | "right";
      maxWidth?: number;
    } = {}
  ) => {
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    const lines = opts.maxWidth
      ? doc.splitTextToSize(text, opts.maxWidth)
      : [text];
    doc.text(lines, opts.align === "center" ? pageW / 2 : margin, y, {
      align: opts.align ?? "left",
    });
    y += lines.length * (size * 0.4) + 2;
  };

  const addHRule = (color: [number, number, number] = [99, 102, 241]) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 4;
  };

  // ── Cover ──────────────────────────────────────────────────────────────────

  // Purple header bar
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 36, "F");

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("LexAI — Hardened Legal Document", pageW / 2, 16, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Adversarial Document Intelligence Platform", pageW / 2, 24, { align: "center" });

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.text(`Generated: ${dateStr}`, pageW / 2, 31, { align: "center" });

  y = 46;

  // ── Score summary box ──────────────────────────────────────────────────────

  doc.setFillColor(18, 18, 26);
  doc.roundedRect(margin, y, contentW, 28, 3, 3, "F");

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text("Initial Risk Score", margin + 10, y + 9);
  doc.text("→", margin + contentW / 2 - 3, y + 14, { align: "center" });
  doc.text("Final Risk Score", margin + contentW - 10, y + 9, { align: "right" });

  const initColor: [number, number, number] = result.initial_score >= 60
    ? [239, 68, 68] : result.initial_score >= 30 ? [245, 158, 11] : [34, 197, 94];
  const finalColor: [number, number, number] = result.final_score >= 60
    ? [239, 68, 68] : result.final_score >= 30 ? [245, 158, 11] : [34, 197, 94];

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...initColor);
  doc.text(String(result.initial_score), margin + 10, y + 22);

  doc.setTextColor(...finalColor);
  doc.text(String(result.final_score), pageW - margin - 10, y + 22, { align: "right" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Hardened through ${result.rounds} adversarial rounds`,
    pageW / 2,
    y + 23,
    { align: "center" }
  );

  y += 36;

  // Document type
  if (result.document_type) {
    addText(
      `Document Type: ${result.document_type.replace(/_/g, " ").toUpperCase()}`,
      9,
      [148, 163, 184]
    );
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  if (result.summary) {
    y += 4;
    addText("Executive Summary", 13, [165, 180, 252], { bold: true });
    addHRule();
    addText(result.summary, 9, [203, 213, 225], { maxWidth: contentW });
    y += 4;
  }

  // ── Document content ───────────────────────────────────────────────────────

  checkPage(20);
  addText("Hardened Document", 13, [165, 180, 252], { bold: true });
  addHRule();

  const docLines = doc.splitTextToSize(documentText || "(No document text)", contentW);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(226, 232, 240);

  for (const line of docLines) {
    checkPage(6);
    doc.text(line, margin, y);
    y += 4.5;
  }

  // ── Footer on each page ────────────────────────────────────────────────────

  const totalPages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(
      `LexAI — Adversarial Legal Intelligence | Task ID: ${taskId.slice(0, 8)} | Page ${i} of ${totalPages}`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  const filename = `LexAI_Hardened_${result.document_type ?? "document"}_${taskId.slice(0, 8)}.pdf`;
  doc.save(filename);
}
