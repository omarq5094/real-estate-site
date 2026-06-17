document.addEventListener("DOMContentLoaded", () => {
  if (typeof TERMS_CONTENT === "undefined") return;

  document.getElementById("termsTitle").textContent = TERMS_CONTENT.title || "الشروط والأحكام";
  document.getElementById("termsIntro").textContent = TERMS_CONTENT.intro || "";
  document.getElementById("termsUpdatedAt").textContent = TERMS_CONTENT.updated_at || "";
  document.getElementById("termsAcceptanceText").textContent = TERMS_CONTENT.acceptance_text || "";

  const sections = document.getElementById("termsSections");
  sections.innerHTML = (TERMS_CONTENT.sections || []).map((section) => `
    <article class="terms-section">
      <h2>${escapeHtml(section.title || "")}</h2>
      <p>${escapeHtml(section.body || "")}</p>
    </article>
  `).join("");
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
