const api = CONFIG.API_URL;

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await requireStaffPage();
  if (!ok) return;

  document.getElementById("staffGuardStatus").classList.add("hidden");
  document.getElementById("adminContent").classList.remove("hidden");

  const currentUser = getAuthUser();
  const usersManagementNavLink = document.getElementById("usersManagementNavLink");
  if (usersManagementNavLink && isManagerRole(currentUser && currentUser.role)) {
    usersManagementNavLink.classList.remove("hidden");
  }

  document.getElementById("loadPendingBtn").addEventListener("click", loadPendingProperties);
  document.getElementById("loadStatsBtn").addEventListener("click", loadStaffDashboardStats);

  loadPendingProperties();
  loadStaffDashboardStats();
});

function getToken() {
  return getAuthToken();
}

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

async function loadPendingProperties() {
  const status = document.getElementById("pendingStatus");
  const grid = document.getElementById("pendingGrid");
  const token = getToken();

  status.className = "status-box";
  status.textContent = "جاري تحميل العقارات تحت المراجعة...";
  grid.innerHTML = "";

  try {
    const result = await apiGet("getPendingProperties", { token });
    if (!result.ok) throw new Error(result.error || "فشل تحميل القائمة");

    const items = result.data || [];
    status.textContent = items.length ? `يوجد ${items.length} عقار تحت المراجعة.` : "لا توجد عقارات تحت المراجعة.";
    renderPending(items);
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function renderPending(items) {
  const grid = document.getElementById("pendingGrid");
  if (!items.length) {
    grid.innerHTML = `
      <article class="admin-empty-state">
        <strong>لا توجد عقارات تحت المراجعة الآن</strong>
        <span>الوضع هادئ، ممتاز. أي إعلان جديد سيظهر هنا مباشرة.</span>
      </article>
    `;
    return;
  }

  grid.innerHTML = items.map(p => {
    const image = getFirstImage(p);
    const id = p.property_id || p.id;
    const cityDistrict = [p.city, p.district].filter(Boolean).join(" - ") || "غير محدد";
    return `
      <article class="property-card admin-review-property-card">
        <div class="admin-card-image-wrap">
          <img src="${escapeHtml(image)}" onerror="this.src='https://placehold.co/800x500?text=No+Image'" />
          <span class="admin-status-chip">تحت المراجعة</span>
        </div>
        <div class="card-body">
          <div class="admin-card-title-row">
            <h3>${escapeHtml(p.title || "عقار بدون عنوان")}</h3>
            <span>${escapeHtml(p.type || "-")}</span>
          </div>
          <div class="meta admin-location-line">${escapeHtml(cityDistrict)}</div>
          <div class="admin-price-row">
            <div class="price">${formatPrice(p.price)} ريال</div>
            ${renderShowPriceBadge(p.show_price)}
          </div>
          <div class="admin-owner-box">
            <span>المالك</span>
            <strong>${escapeHtml(p.owner_name || "-")}</strong>
            <small>${escapeHtml(p.owner_phone || "-")}</small>
          </div>
          <p>${escapeHtml(p.description || "")}</p>
          <div class="actions admin-card-actions">
            <a class="secondary-btn" href="admin-property.html?id=${encodeURIComponent(id)}">عرض التفاصيل</a>
            <button class="primary-btn" onclick="approveProperty('${escapeAttr(id)}')">قبول ونشر</button>
            <button class="warning-btn" onclick="needsUpdate('${escapeAttr(id)}')">طلب تعديل</button>
            <button class="danger-btn" onclick="rejectProperty('${escapeAttr(id)}')">رفض</button>
            ${p.map_url ? `<a class="secondary-btn" href="${escapeHtml(p.map_url)}" target="_blank">Google Maps</a>` : ""}
          </div>
        </div>
      </article>
    `;
  }).join("");
}

async function approveProperty(propertyId) {
  const note = prompt("ملاحظة القبول:", "تمت الموافقة");
  await reviewAction("approveProperty", propertyId, note || "تمت الموافقة");
}

async function rejectProperty(propertyId) {
  const note = prompt("سبب الرفض:", "معلومات غير مكتملة");
  if (note === null) return;
  await reviewAction("rejectProperty", propertyId, note);
}

async function needsUpdate(propertyId) {
  const note = prompt("ما التعديل المطلوب من العميل؟", "يرجى تحديث الصور أو البيانات");
  if (note === null) return;

  await reviewAction("changePropertyStatus", propertyId, note, "needs_update");
}

async function reviewAction(action, propertyId, note, statusValue) {
  const status = document.getElementById("pendingStatus");
  status.className = "status-box";
  status.textContent = "جاري تنفيذ العملية...";

  try {
    const payload = {
      action,
      token: getToken(),
      property_id: propertyId,
      note
    };

    if (statusValue) payload.status = statusValue;

    const result = await apiPost(payload);
    if (!result.ok) throw new Error(result.error || "فشلت العملية");

    status.classList.add("success");
    status.textContent = result.message || "تم تنفيذ العملية.";
    await loadPendingProperties();
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function getFirstImage(property) {
  if (Array.isArray(property.images) && property.images.length) {
    return resolveImageUrl(property.images[0]);
  }
  return "https://placehold.co/800x500?text=No+Image";
}

function renderShowPriceBadge(value) {
  const show = String(value || "").toLowerCase() === "yes";
  return `<div class="price-visibility-badge ${show ? "visible" : "hidden-price"}">${show ? "العميل وافق على عرض السعر" : "العميل لا يريد عرض السعر"}</div>`;
}

function formatPrice(value) {
  const n = Number(value || 0);
  return n.toLocaleString("en-US");
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
  return String(value ?? "").replaceAll("'", "\'");
}


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


async function loadStaffDashboardStats() {
  const status = document.getElementById("staffStatsStatus");
  const grid = document.getElementById("staffStatsGrid");
  if (!status || !grid) return;

  status.className = "status-box";
  status.textContent = "جاري تحميل الإحصائيات...";
  grid.innerHTML = "";

  try {
    let result = await apiGet("getStaffDashboardStats", { token: getToken() });

    if (!result.ok) {
      result = await fallbackStaffStatsFromAllProperties();
    }

    if (!result.ok) throw new Error(result.error || "تعذر تحميل الإحصائيات");

    const s = result.data;
    grid.innerHTML = `
      <article class="mini-stat-card admin-metric-card metric-active"><span>العقارات المنشورة</span><strong>${s.active_properties || 0}</strong><small>جاهزة للعرض</small></article>
      <article class="mini-stat-card admin-metric-card metric-pending"><span>تحت المراجعة</span><strong>${s.pending_properties || 0}</strong><small>تحتاج قرار</small></article>
      <article class="mini-stat-card admin-metric-card metric-update"><span>تحتاج تعديل</span><strong>${s.needs_update_properties || 0}</strong><small>بانتظار العميل</small></article>
      <article class="mini-stat-card admin-metric-card metric-leads"><span>طلبات جديدة</span><strong>${s.new_leads || 0}</strong><small>Leads</small></article>
      <article class="mini-stat-card admin-metric-card metric-city"><span>أكثر مدينة</span><strong>${escapeHtml(s.top_city || "-")}</strong><small>الأعلى نشاطًا</small></article>
    `;
    status.classList.add("success");
    status.textContent = "تم تحميل الإحصائيات.";
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}


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


async function fallbackStaffStatsFromAllProperties() {
  try {
    const result = await apiGet("getAllPropertiesForAdmin", { token: getToken() });
    if (!result.ok) return result;

    const properties = result.data || [];
    const active = properties.filter(p => String(p.status || "").toLowerCase() === "active").length;
    const pending = properties.filter(p => String(p.status || "").toLowerCase() === "pending").length;
    const needsUpdate = properties.filter(p => String(p.status || "").toLowerCase() === "needs_update").length;

    const cityCounts = {};
    properties
      .filter(p => String(p.status || "").toLowerCase() === "active")
      .forEach(p => {
        const city = String(p.city || "-").trim() || "-";
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      });

    let topCity = "-";
    let topCount = 0;
    Object.keys(cityCounts).forEach(city => {
      if (cityCounts[city] > topCount) {
        topCity = city;
        topCount = cityCounts[city];
      }
    });

    return {
      ok: true,
      data: {
        active_properties: active,
        pending_properties: pending,
        needs_update_properties: needsUpdate,
        new_leads: 0,
        top_city: topCity,
        top_city_count: topCount
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}




async 







async 







function isManagerRole(role) {
  return ["manager", "admin"].includes(String(role || "").toLowerCase());
}
