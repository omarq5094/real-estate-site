const api = CONFIG.API_URL;

const LEAD_STATUSES = [
  ["new", "جديد"],
  ["contacted", "تم التواصل"],
  ["interested", "مهتم"],
  ["viewing_scheduled", "موعد معاينة"],
  ["agreed", "تم الاتفاق"],
  ["closed_won", "مغلق بنجاح"],
  ["not_interested", "غير مهتم"],
  ["no_answer", "لم يرد"],
  ["cancelled", "ملغي"],
  ["archived", "مؤرشف"]
];

let allLeads = [];
let staffUsers = [];

const STATUS_LABELS = Object.fromEntries(LEAD_STATUSES);

const REQUEST_TYPE_LABELS = {
  inquiry: "استفسار",
  visit: "طلب معاينة",
  viewing: "طلب معاينة",
  call: "طلب اتصال",
  negotiation: "تفاوض"
};

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  document.querySelector("[data-staff-guard-status]").classList.add("hidden");
  document.getElementById("leadsContent").classList.remove("hidden");

  setupFilters();
  document.getElementById("refreshLeadsBtn").addEventListener("click", loadLeadsWorkspace);
  document.getElementById("resetFiltersBtn").addEventListener("click", resetFilters);

  await loadLeadsWorkspace();
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
  const response = await fetch(url.toString());
  return response.json();
}

async function apiPost(payload) {
  const response = await fetch(api, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function setupFilters() {
  const statusFilter = document.getElementById("statusFilter");
  statusFilter.innerHTML += LEAD_STATUSES.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");

  ["searchInput", "statusFilter", "typeFilter", "assigneeFilter", "dueFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", applyFilters);
    document.getElementById(id).addEventListener("change", applyFilters);
  });
}

async function loadLeadsWorkspace() {
  const status = document.getElementById("leadsStatus");
  status.className = "status-box compact-status";
  status.textContent = "جاري تحميل طلبات العملاء...";

  try {
    const [leadsResult, staffResult] = await Promise.all([
      apiGet("getLeads", { token: getAuthToken() }),
      apiGet("getAssignableStaff", { token: getAuthToken() })
    ]);

    if (!leadsResult.ok) throw new Error(leadsResult.error || "تعذر تحميل الطلبات");
    if (!staffResult.ok) throw new Error(staffResult.error || "تعذر تحميل الموظفين");

    allLeads = leadsResult.data || [];
    staffUsers = staffResult.data || [];
    renderAssigneeFilter();
    renderMetrics();
    applyFilters();

    status.classList.add("success");
    status.textContent = `تم تحديث البيانات. إجمالي الطلبات: ${allLeads.length}.`;
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function renderAssigneeFilter() {
  const select = document.getElementById("assigneeFilter");
  const current = select.value;
  select.innerHTML = `<option value="">كل الموظفين</option><option value="__unassigned__">غير مسند</option>${staffUsers.map(user => `
    <option value="${escapeAttr(user.user_id)}">${escapeHtml(user.name || user.user_id)} — ${escapeHtml(user.role || "")}</option>
  `).join("")}`;
  select.value = current;
}

function renderMetrics() {
  const todayKey = getDateKey(new Date());
  const metrics = {
    total: allLeads.length,
    new: allLeads.filter(lead => normalize(lead.status) === "new").length,
    dueToday: allLeads.filter(lead => getDateKey(lead.follow_up_at) === todayKey).length,
    overdue: allLeads.filter(isOverdue).length,
    won: allLeads.filter(lead => normalize(lead.status) === "closed_won").length
  };

  document.getElementById("crmMetrics").innerHTML = `
    ${renderMetricCard("كل الطلبات", metrics.total, "Pipeline", "metric-total")}
    ${renderMetricCard("طلبات جديدة", metrics.new, "تحتاج فرزًا أوليًا", "metric-new")}
    ${renderMetricCard("متابعة اليوم", metrics.dueToday, "لا تؤجل التواصل", "metric-today")}
    ${renderMetricCard("متأخرة", metrics.overdue, "تحتاج إجراء سريع", "metric-overdue")}
    ${renderMetricCard("مغلقة بنجاح", metrics.won, "فرص تم تحويلها", "metric-won")}
  `;
}

function renderMetricCard(title, value, description, className) {
  return `<article class="mini-stat-card admin-metric-card crm-metric-card ${className}"><span>${title}</span><strong>${value}</strong><small>${description}</small></article>`;
}

function applyFilters() {
  const query = normalize(document.getElementById("searchInput").value);
  const status = document.getElementById("statusFilter").value;
  const type = document.getElementById("typeFilter").value;
  const assignee = document.getElementById("assigneeFilter").value;
  const due = document.getElementById("dueFilter").value;

  const filtered = allLeads.filter((lead) => {
    const searchable = normalize([
      lead.customer_name,
      lead.customer_phone,
      lead.property_title,
      lead.property_id,
      lead.message,
      lead.assigned_to_name
    ].join(" "));

    if (query && !searchable.includes(query)) return false;
    if (status === "__active__" && ["cancelled", "archived"].includes(normalize(lead.status))) return false;
    if (status && status !== "__active__" && normalize(lead.status) !== status) return false;
    if (type && normalize(lead.request_type) !== type) return false;
    if (assignee === "__unassigned__" && String(lead.assigned_to || "").trim()) return false;
    if (assignee && assignee !== "__unassigned__" && String(lead.assigned_to || "") !== assignee) return false;
    if (!matchesDueFilter(lead, due)) return false;
    return true;
  });

  renderLeadsTable(filtered);
  document.getElementById("resultsCount").textContent = `يعرض ${filtered.length} من أصل ${allLeads.length} طلب.`;
}

function resetFilters() {
  ["searchInput", "statusFilter", "typeFilter", "assigneeFilter", "dueFilter"].forEach(id => {
    document.getElementById(id).value = id === "statusFilter" ? "__active__" : "";
  });
  applyFilters();
}

function renderLeadsTable(leads) {
  const tbody = document.querySelector("#leadsTable tbody");
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="crm-empty-state">لا توجد طلبات مطابقة للفلاتر الحالية.</div></td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map((lead) => {
    const phone = String(lead.customer_phone || "").trim();
    const detailsUrl = `lead-details.html?id=${encodeURIComponent(lead.lead_id || "")}`;
    const propertyUrl = lead.property_id ? `property.html?id=${encodeURIComponent(lead.property_id)}` : "#";
    const dueClass = isOverdue(lead) ? "crm-due-overdue" : "";

    return `
      <tr>
        <td>
          <div class="crm-cell-main">${escapeHtml(lead.customer_name || "-")}</div>
          <div class="crm-cell-sub">${escapeHtml(phone || "-")}</div>
        </td>
        <td>
          <a class="crm-property-link" href="${propertyUrl}" target="_blank">${escapeHtml(lead.property_title || lead.property_id || "-")}</a>
          <div class="crm-cell-sub">${escapeHtml(lead.property_city || "")}</div>
        </td>
        <td><span class="crm-type-chip">${escapeHtml(translateRequestType(lead.request_type))}</span></td>
        <td>
          <select class="crm-inline-status" data-lead-id="${escapeAttr(lead.lead_id)}" aria-label="تغيير حالة الطلب">
            ${LEAD_STATUSES.map(([value, label]) => `<option value="${value}" ${normalize(lead.status) === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </td>
        <td>${escapeHtml(lead.assigned_to_name || "غير مسند")}</td>
        <td><span class="crm-due-text ${dueClass}">${escapeHtml(formatDateTime(lead.follow_up_at) || "بدون موعد")}</span></td>
        <td>
          <div class="crm-row-actions">
            ${phone ? `<a class="crm-icon-btn" href="tel:${escapeAttr(phone)}" title="اتصال مباشر">اتصال</a>` : ""}
            ${phone ? `<a class="crm-icon-btn crm-whatsapp-btn" href="${buildWhatsappUrl(phone, lead.property_title)}" target="_blank" title="فتح WhatsApp">WhatsApp</a>` : ""}
            <a class="crm-icon-btn crm-details-btn" href="${detailsUrl}">التفاصيل</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".crm-inline-status").forEach((select) => {
    select.addEventListener("change", async (event) => {
      await quickUpdateStatus(event.currentTarget.dataset.leadId, event.currentTarget.value, event.currentTarget);
    });
  });
}

async function quickUpdateStatus(leadId, status, selectNode) {
  const previous = allLeads.find(lead => String(lead.lead_id) === String(leadId));
  const oldValue = previous ? normalize(previous.status) : "new";
  selectNode.disabled = true;

  try {
    const result = await apiPost({ action: "updateLead", token: getAuthToken(), lead_id: leadId, status });
    if (!result.ok) throw new Error(result.error || "تعذر تحديث الحالة");
    if (previous) previous.status = status;
    renderMetrics();
    applyFilters();
  } catch (error) {
    selectNode.value = oldValue;
    alert(error.message);
  } finally {
    selectNode.disabled = false;
  }
}

function matchesDueFilter(lead, due) {
  if (!due) return true;
  const raw = String(lead.follow_up_at || "").trim();
  if (due === "none") return !raw;
  if (!raw) return false;
  if (due === "today") return getDateKey(raw) === getDateKey(new Date());
  if (due === "overdue") return isOverdue(lead);
  if (due === "upcoming") return new Date(raw).getTime() > Date.now();
  return true;
}

function isOverdue(lead) {
  const raw = String(lead.follow_up_at || "").trim();
  if (!raw) return false;
  const closedStatuses = ["closed_won", "cancelled", "archived", "not_interested"];
  if (closedStatuses.includes(normalize(lead.status))) return false;
  const time = new Date(raw).getTime();
  return Number.isFinite(time) && time < Date.now();
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function getDateKey(value) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function translateRequestType(value) {
  return REQUEST_TYPE_LABELS[normalize(value)] || value || "استفسار";
}

function buildWhatsappUrl(phone, propertyTitle) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "").replace(/^0/, "966");
  const message = `السلام عليكم، متابعة طلبكم بخصوص العقار: ${propertyTitle || "العقار"}`;
  return `https://wa.me/${encodeURIComponent(normalizedPhone)}?text=${encodeURIComponent(message)}`;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
