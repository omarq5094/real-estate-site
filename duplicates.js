const api = CONFIG.API_URL;
let duplicateGroups = [];

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  document.querySelector("[data-staff-guard-status]").classList.add("hidden");
  document.getElementById("duplicatesContent").classList.remove("hidden");
  document.getElementById("refreshDuplicatesBtn").addEventListener("click", loadDuplicates);

  loadDuplicates();
});

async function apiGet(action, params = {}) {
  if (params && params.token) {
    const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action: action }, params)) });
    return response.json();
  }
  const url = new URL(api);
  url.searchParams.set("action", action);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(payload) {
  const res = await fetch(api, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  return res.json();
}

async function loadDuplicates() {
  const status = document.getElementById("duplicatesStatus");
  const list = document.getElementById("duplicatesList");

  status.className = "status-box";
  status.textContent = "جاري فحص التكرارات...";
  list.innerHTML = "";

  try {
    const result = await apiGet("getDuplicateProperties", {
      token: getAuthToken()
    });

    if (!result.ok) throw new Error(result.error || "فشل تحميل التكرارات");

    duplicateGroups = result.data || [];

    if (!duplicateGroups.length) {
      status.classList.add("success");
      status.textContent = "لا توجد تكرارات واضحة حاليًا.";
      return;
    }

    status.classList.add("error");
    status.textContent = `تم العثور على ${duplicateGroups.length} مجموعة تكرار.`;

    list.innerHTML = duplicateGroups.map(renderDuplicateGroup).join("");
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function renderDuplicateGroup(group, groupIndex) {
  const label = group.type === "property_id"
    ? `تكرار رقم العقار: ${escapeHtml(group.key)}`
    : "تشابه إعلان لنفس المالك";

  return `
    <section class="duplicate-group">
      <h3>${label}</h3>
      <div class="duplicate-group-meta">عدد الإعلانات المتشابهة: ${group.items.length}</div>
      <div class="duplicate-card-grid">
        ${group.items.map((item, index) => renderDuplicateCard(item, index)).join("")}
      </div>
    </section>
  `;
}

function renderDuplicateCard(p, index) {
  const id = p.property_id || "";
  const status = String(p.status || "").toLowerCase();

  return `
    <article class="property-card duplicate-card">
      <div class="card-body">
        <span class="status-pill ${getStatusClass(status)}">${translateStatus(status)}</span>
        <h3>${escapeHtml(p.title || "عقار بدون عنوان")}</h3>
        <div class="meta">رقم العقار: ${escapeHtml(id)}</div>
        <div class="meta">المالك: ${escapeHtml(p.owner_name || "-")} • ${escapeHtml(p.owner_phone || "-")}</div>
        <div class="meta">${escapeHtml(p.city || "")} - ${escapeHtml(p.district || "")}</div>
        <div class="price">${formatPrice(p.price)} ريال</div>
        <div class="meta">تاريخ الإنشاء: ${escapeHtml(p.created_at || "-")}</div>
        <div class="actions">
          <a class="secondary-btn" href="admin-property.html?id=${encodeURIComponent(id)}">عرض التفاصيل</a>
          ${status !== "archived" ? `<button class="warning-btn" type="button" onclick="archiveDuplicate('${escapeAttr(id)}')">أرشفة هذا الإعلان</button>` : ""}
        </div>
      </div>
    </article>
  `;
}

async function archiveDuplicate(propertyId) {
  const confirmed = confirm("هل تريد أرشفة هذا الإعلان؟ لن يظهر للزوار أو العملاء، لكنه سيبقى محفوظًا في Google Sheets.");
  if (!confirmed) return;

  const note = prompt("ملاحظة الأرشفة:", "أرشفة إعلان مكرر") || "أرشفة إعلان مكرر";

  const status = document.getElementById("duplicatesStatus");
  status.className = "status-box";
  status.textContent = "جاري أرشفة الإعلان...";

  try {
    const result = await apiPost({
      action: "archiveProperty",
      token: getAuthToken(),
      property_id: propertyId,
      note
    });

    if (!result.ok) throw new Error(result.error || "فشل أرشفة الإعلان");

    status.classList.add("success");
    status.textContent = result.message || "تمت الأرشفة.";
    await loadDuplicates();
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function translateStatus(status) {
  const map = {
    pending: "تحت المراجعة",
    active: "منشور",
    needs_update: "يحتاج تعديل",
    rejected: "مرفوض",
    hidden: "مخفي",
    sold: "مباع",
    rented: "مؤجر",
    archived: "مؤرشف",
    deleted_by_owner: "محذوف من المالك"
  };

  return map[String(status || "").toLowerCase()] || status || "-";
}

function getStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active" || s === "sold" || s === "rented") return "ok";
  if (s === "pending") return "wait";
  if (s === "needs_update" || s === "archived") return "warn";
  if (s === "rejected" || s === "deleted_by_owner") return "bad";
  return "";
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
  return String(value ?? "").replaceAll("'", "\\'");
}
