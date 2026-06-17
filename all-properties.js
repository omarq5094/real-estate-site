const api = CONFIG.API_URL;
let allAdminProperties = [];

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  document.querySelector("[data-staff-guard-status]").classList.add("hidden");
  document.getElementById("allPropertiesContent").classList.remove("hidden");

  document.getElementById("refreshAllBtn").addEventListener("click", loadAllProperties);
  ["adminSearchInput", "adminStatusFilter", "adminTypeFilter", "adminCityFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderFilteredAdminProperties);
  });

  loadAllProperties();
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

async function apiPost(payload) {
  const res = await fetch(api, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function loadAllProperties() {
  const status = document.getElementById("allPropertiesStatus");
  status.className = "status-box";
  status.textContent = "جاري تحميل العقارات...";

  try {
    const result = await apiGet("getAllPropertiesForAdmin", { token: getAuthToken() });
    if (!result.ok) throw new Error(result.error || "فشل تحميل العقارات");

    allAdminProperties = result.data || [];
    renderFilteredAdminProperties();

    status.classList.add("success");
    status.textContent = `تم تحميل ${allAdminProperties.length} عقار.`;
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function renderFilteredAdminProperties() {
  const q = document.getElementById("adminSearchInput").value.trim().toLowerCase();
  const st = document.getElementById("adminStatusFilter").value;
  const type = document.getElementById("adminTypeFilter").value;
  const city = document.getElementById("adminCityFilter").value.trim().toLowerCase();

  const filtered = allAdminProperties.filter((p) => {
    const text = `${p.title || ""} ${p.city || ""} ${p.district || ""} ${p.owner_name || ""} ${p.owner_phone || ""}`.toLowerCase();
    return (!q || text.includes(q)) &&
      (!st || String(p.status || "").toLowerCase() === st) &&
      (!type || p.type === type) &&
      (!city || String(p.city || "").toLowerCase().includes(city));
  });

  document.getElementById("allPropertiesGrid").innerHTML = filtered.map(renderAdminPropertyCard).join("");
}

function renderAdminPropertyCard(p) {
  const id = p.property_id || "";
  const image = getCoverImage(p.images);
  const status = String(p.status || "").toLowerCase();

  return `
    <article class="property-card">
      <img src="${escapeHtml(image)}" onerror="this.src='https://placehold.co/800x500?text=No+Image'" />
      <div class="card-body">
        <div class="property-card-badges">
          <span class="status-pill ${getStatusClass(status)}">${translateStatus(status)}</span>
          ${String(p.is_featured || "").toLowerCase() === "yes" ? `<span class="status-pill ok">مثبت بالأعلى</span>` : ""}
        </div>
        <h3>${escapeHtml(p.title || "عقار بدون عنوان")}</h3>
        <div class="meta">${escapeHtml(p.city || "")} - ${escapeHtml(p.district || "")}</div>
        <div class="price">${formatPrice(p.price)} ريال</div>
        ${renderShowPriceBadge(p.show_price)}
        <div class="meta">المالك: ${escapeHtml(p.owner_name || "-")} • ${escapeHtml(p.owner_phone || "-")}</div>

        <label>تغيير الحالة
          <select onchange="changeStatus('${escapeAttr(id)}', this.value)">
            ${statusOptions(status)}
          </select>
        </label>

        <div class="actions">
          <a class="secondary-btn" href="admin-property.html?id=${encodeURIComponent(id)}">عرض التفاصيل</a>
          <button class="warning-btn" type="button" onclick="toggleFeatured('${escapeAttr(id)}', '${String(p.is_featured || "").toLowerCase() === "yes" ? "no" : "yes"}')">
            ${String(p.is_featured || "").toLowerCase() === "yes" ? "إلغاء التثبيت" : "تثبيت بالأعلى"}
          </button>
        </div>
      </div>
    </article>`;
}

function renderShowPriceBadge(value) {
  const show = String(value || "").toLowerCase() === "yes";
  return `<div class="price-visibility-badge ${show ? "visible" : "hidden-price"}">${show ? "العميل وافق على عرض السعر" : "العميل لا يريد عرض السعر"}</div>`;
}

function statusOptions(current) {
  const options = [
    ["pending", "تحت المراجعة"],
    ["active", "منشور"],
    ["needs_update", "يحتاج تعديل"],
    ["hidden", "مخفي"],
    ["sold", "مباع"],
    ["rented", "مؤجر"],
    ["rejected", "مرفوض"]
  ];

  return options.map(([value, label]) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`).join("");
}

async function changeStatus(propertyId, newStatus) {
  const note = prompt(`تغيير حالة العقار إلى: ${translateStatus(newStatus)}\\nاكتب ملاحظة اختيارية:`, "");
  const status = document.getElementById("allPropertiesStatus");
  status.className = "status-box";
  status.textContent = "جاري تغيير الحالة...";

  try {
    const result = await apiPost({
      action: "changePropertyStatus",
      token: getAuthToken(),
      property_id: propertyId,
      status: newStatus,
      note: note || ""
    });

    if (!result.ok) throw new Error(result.error || "فشل تغيير الحالة");

    status.classList.add("success");
    status.textContent = result.message || "تم تغيير الحالة.";
    await loadAllProperties();
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

async function toggleFeatured(propertyId, nextValue) {
  const label = nextValue === "yes" ? "تثبيت العقار في أعلى الموقع" : "إلغاء تثبيت العقار";
  if (!confirm(`${label}؟`)) return;

  const status = document.getElementById("allPropertiesStatus");
  status.className = "status-box";
  status.textContent = "جاري تحديث التثبيت...";

  try {
    const result = await apiPost({
      action: "setPropertyFeatured",
      token: getAuthToken(),
      property_id: propertyId,
      is_featured: nextValue,
      note: label
    });

    if (!result.ok) throw new Error(result.error || "فشل تحديث التثبيت");

    status.classList.add("success");
    status.textContent = result.message || "تم تحديث التثبيت.";
    await loadAllProperties();
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function formatPrice(value) { return Number(value || 0).toLocaleString("en-US"); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function escapeAttr(value) { return String(value ?? "").replaceAll("'","\\'"); }

function resolveImageUrl(imgOrUrl) {
  if (!imgOrUrl) return "https://placehold.co/800x500?text=No+Image";

  if (typeof imgOrUrl === "object") {
    if (imgOrUrl.drive_file_id) {
      return `https://drive.google.com/thumbnail?id=${encodeURIComponent(imgOrUrl.drive_file_id)}&sz=w1200`;
    }

    if (imgOrUrl.image_url) {
      return normalizeDriveImageUrl(imgOrUrl.image_url);
    }

    return "https://placehold.co/800x500?text=No+Image";
  }

  return normalizeDriveImageUrl(String(imgOrUrl));
}

function normalizeDriveImageUrl(url) {
  if (!url) return "https://placehold.co/800x500?text=No+Image";

  const text = String(url);
  const idMatch = text.match(/[?&]id=([^&]+)/);

  if (idMatch && idMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(idMatch[1])}&sz=w1200`;
  }

  const fileMatch = text.match(/\/file\/d\/([^/]+)/);

  if (fileMatch && fileMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileMatch[1])}&sz=w1200`;
  }

  return text;
}

function getCoverImage(images) {
  if (!Array.isArray(images) || !images.length) {
    return "https://placehold.co/800x500?text=No+Image";
  }

  const cover = images.find((img) => String(img.is_cover || "").toLowerCase() === "yes");
  return resolveImageUrl(cover || images[0]);
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
    deleted_by_owner: "محذوف من المالك"
  };

  return map[String(status || "").toLowerCase()] || status || "-";
}

function getStatusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "ok";
  if (s === "pending") return "wait";
  if (s === "needs_update") return "warn";
  if (s === "rejected" || s === "deleted_by_owner") return "bad";
  if (s === "sold" || s === "rented") return "ok";
  return "";
}
