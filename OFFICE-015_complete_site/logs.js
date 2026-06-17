const api = CONFIG.API_URL;

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  document.querySelector("[data-staff-guard-status]").classList.add("hidden");
  document.getElementById("logsContent").classList.remove("hidden");
  document.getElementById("refreshLogsBtn").addEventListener("click", loadLogs);

  loadLogs();
});

async function apiGet(action, params = {}) {
  if (params && params.token) {
    const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action: action }, params)) });
    return response.json();
  }
  const url = new URL(api);
  url.searchParams.set("action", action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url.toString());
  return res.json();
}

async function loadLogs() {
  const status = document.getElementById("logsStatus");
  const tbody = document.querySelector("#logsTable tbody");

  status.className = "status-box";
  status.textContent = "جاري تحميل سجل العمليات...";
  tbody.innerHTML = "";

  try {
    const result = await apiGet("getApprovalLogs", { token: getAuthToken(), limit: 100 });
    if (!result.ok) throw new Error(result.error || "فشل تحميل السجل");

    const logs = result.data || [];
    tbody.innerHTML = logs.map((log) => `
      <tr>
        <td>${escapeHtml(log.created_at || "")}</td>
        <td>${escapeHtml(log.action || "")}</td>
        <td>${escapeHtml(log.property_id || "")}</td>
        <td>${escapeHtml(log.performed_by || "")}</td>
        <td>${escapeHtml(log.old_status || "")}</td>
        <td>${escapeHtml(log.new_status || "")}</td>
        <td>${escapeHtml(log.note || "")}</td>
      </tr>
    `).join("");

    status.classList.add("success");
    status.textContent = `تم تحميل ${logs.length} عملية.`;
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
