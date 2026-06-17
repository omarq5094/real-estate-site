const api = CONFIG.API_URL;
const leadId = new URLSearchParams(location.search).get("id");

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

const STATUS_LABELS = Object.fromEntries(LEAD_STATUSES);
const REQUEST_TYPE_LABELS = {
  inquiry: "استفسار",
  visit: "طلب معاينة",
  viewing: "طلب معاينة",
  call: "طلب اتصال",
  negotiation: "تفاوض"
};

let currentLead = null;
let currentProperty = null;
let staffUsers = [];

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  document.querySelector("[data-staff-guard-status]").classList.add("hidden");
  document.getElementById("leadDetailsContent").classList.remove("hidden");
  document.getElementById("leadUpdateForm").addEventListener("submit", saveLeadUpdate);

  if (!leadId) {
    showStatus("لم يتم تحديد رقم الطلب.", true);
    return;
  }

  await loadLeadDetails();
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

async function loadLeadDetails() {
  showStatus("جاري تحميل تفاصيل الطلب...");
  try {
    const [detailsResult, staffResult] = await Promise.all([
      apiGet("getLeadById", { token: getAuthToken(), lead_id: leadId }),
      apiGet("getAssignableStaff", { token: getAuthToken() })
    ]);

    if (!detailsResult.ok) throw new Error(detailsResult.error || "تعذر تحميل الطلب");
    if (!staffResult.ok) throw new Error(staffResult.error || "تعذر تحميل الموظفين");

    currentLead = detailsResult.data.lead;
    currentProperty = detailsResult.data.property;
    staffUsers = staffResult.data || [];

    renderLead(detailsResult.data.logs || []);
    showStatus("تم تحميل بيانات الطلب.", false, true);
  } catch (error) {
    showStatus(error.message, true);
  }
}

function renderLead(logs) {
  const lead = currentLead;
  document.getElementById("clientName").textContent = lead.customer_name || "عميل بدون اسم";
  document.getElementById("clientPhone").textContent = lead.customer_phone || "بدون رقم جوال";

  const badge = document.getElementById("leadStatusBadge");
  badge.textContent = translateStatus(lead.status);
  badge.className = `crm-status-chip crm-status-${normalize(lead.status)}`;

  renderDirectActions();
  renderClientInfo();
  renderPropertySummary();
  renderUpdateForm();
  renderTimeline(logs);
}

function renderDirectActions() {
  const phone = String(currentLead.customer_phone || "").trim();
  const actions = [];
  if (phone) {
    actions.push(`<a class="primary-btn" href="tel:${escapeAttr(phone)}">اتصال مباشر</a>`);
    actions.push(`<a class="crm-whatsapp-action" href="${buildWhatsappUrl(phone, currentProperty && currentProperty.title)}" target="_blank">فتح WhatsApp</a>`);
  }
  document.getElementById("directActions").innerHTML = actions.join("") || `<span class="muted">لا يوجد رقم جوال للتواصل.</span>`;
}

function renderClientInfo() {
  const lead = currentLead;
  document.getElementById("clientInfoGrid").innerHTML = [
    ["نوع الطلب", translateRequestType(lead.request_type)],
    ["الموظف المسؤول", lead.assigned_to_name || "غير مسند"],
    ["موعد المتابعة", formatDateTime(lead.follow_up_at) || "لم يحدد"],
    ["تاريخ إنشاء الطلب", formatDateTime(lead.created_at) || "-"]
  ].map(([label, value]) => `<div class="crm-info-item"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("") + `
    <div class="crm-info-item crm-info-wide"><span>رسالة العميل</span><strong>${escapeHtml(lead.message || "لا توجد رسالة")}</strong></div>
  `;
}

function renderPropertySummary() {
  const container = document.getElementById("propertySummary");
  if (!currentProperty) {
    container.innerHTML = `<div class="crm-empty-state">تعذر العثور على العقار المرتبط بهذا الطلب.</div>`;
    return;
  }

  const p = currentProperty;
  container.innerHTML = `
    <div class="crm-property-summary">
      <div>
        <h3>${escapeHtml(p.title || "عقار بدون عنوان")}</h3>
        <p>${escapeHtml([p.city, p.district].filter(Boolean).join(" - ") || "الموقع غير محدد")}</p>
      </div>
      <div class="crm-property-summary-actions">
        <span class="crm-price-tag">${formatPrice(p.price)} ريال</span>
        <a class="secondary-btn" href="property.html?id=${encodeURIComponent(p.property_id || "")}" target="_blank">فتح صفحة العقار</a>
      </div>
    </div>
  `;
}

function renderUpdateForm() {
  const statusSelect = document.getElementById("leadStatusSelect");
  statusSelect.innerHTML = LEAD_STATUSES.map(([value, label]) => `<option value="${value}" ${normalize(currentLead.status) === value ? "selected" : ""}>${label}</option>`).join("");

  const assignedSelect = document.getElementById("assignedToSelect");
  assignedSelect.innerHTML = `<option value="">بدون إسناد</option>${staffUsers.map(user => `<option value="${escapeAttr(user.user_id)}" ${String(currentLead.assigned_to || "") === String(user.user_id) ? "selected" : ""}>${escapeHtml(user.name || user.user_id)} — ${escapeHtml(user.role || "")}</option>`).join("")}`;

  document.getElementById("followUpAtInput").value = toDateTimeLocal(currentLead.follow_up_at);
  document.getElementById("leadNotesInput").value = currentLead.notes || "";
}

function renderTimeline(logs) {
  const container = document.getElementById("leadTimeline");
  if (!logs.length) {
    container.innerHTML = `<div class="crm-empty-state">لا توجد تحديثات سابقة لهذا الطلب.</div>`;
    return;
  }

  container.innerHTML = logs.map(log => `
    <article class="crm-timeline-item">
      <div class="crm-timeline-dot"></div>
      <div>
        <div class="crm-timeline-head">
          <strong>${escapeHtml(translateAction(log.action))}</strong>
          <span>${escapeHtml(formatDateTime(log.created_at) || "-")}</span>
        </div>
        <p>${escapeHtml(log.note || "تم تحديث الطلب")}</p>
        <small>${escapeHtml(log.performed_by || "-")} ${log.new_status ? `• ${escapeHtml(translateStatus(log.new_status))}` : ""}</small>
      </div>
    </article>
  `).join("");
}

async function saveLeadUpdate(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "جاري الحفظ...";

  try {
    const payload = {
      action: "updateLead",
      token: getAuthToken(),
      lead_id: leadId,
      status: document.getElementById("leadStatusSelect").value,
      assigned_to: document.getElementById("assignedToSelect").value,
      follow_up_at: document.getElementById("followUpAtInput").value,
      notes: document.getElementById("leadNotesInput").value
    };

    const result = await apiPost(payload);
    if (!result.ok) throw new Error(result.error || "تعذر حفظ التحديث");
    await loadLeadDetails();
    showStatus(result.message || "تم حفظ التحديث.", false, true);
  } catch (error) {
    showStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "حفظ التحديث";
  }
}

function showStatus(message, isError = false, isSuccess = false) {
  const node = document.getElementById("leadDetailsStatus");
  node.className = "status-box compact-status";
  if (isError) node.classList.add("error");
  if (isSuccess) node.classList.add("success");
  node.textContent = message;
}

function translateStatus(value) {
  return STATUS_LABELS[normalize(value)] || value || "-";
}

function translateRequestType(value) {
  return REQUEST_TYPE_LABELS[normalize(value)] || value || "استفسار";
}

function translateAction(value) {
  const actions = {
    created: "إنشاء الطلب",
    updated: "تحديث الطلب",
    status: "تغيير الحالة",
    assigned_to: "تعيين الموظف المسؤول",
    follow_up_at: "تحديد موعد المتابعة",
    notes: "إضافة ملاحظة"
  };
  return String(value || "updated").split(",").map(action => actions[action] || action).join("، ");
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

function buildWhatsappUrl(phone, propertyTitle) {
  const normalizedPhone = String(phone || "").replace(/\D/g, "").replace(/^0/, "966");
  const message = `السلام عليكم، متابعة طلبكم بخصوص العقار: ${propertyTitle || "العقار"}`;
  return `https://wa.me/${encodeURIComponent(normalizedPhone)}?text=${encodeURIComponent(message)}`;
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("en-US");
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
