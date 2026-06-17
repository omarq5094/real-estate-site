let currentProperty = null;
let coverImageRequestInFlight = false;
document.addEventListener("DOMContentLoaded", () => {
  if (!requireLogin()) return;
  document.getElementById("editPropertyForm").addEventListener("submit", submitEdit);
  loadPropertyForEdit();
});

async function loadPropertyForEdit() {
  const propertyId = new URLSearchParams(location.search).get("id");
  const status = document.getElementById("editStatus");
  const form = document.getElementById("editPropertyForm");
  if (!propertyId) { status.classList.add("error"); status.textContent = "رقم العقار غير موجود."; return; }
  try {
    const result = await authApiGet("getMyPropertyById", { token: getAuthToken(), property_id: propertyId });
    if (!result.ok) throw new Error(result.error || "تعذر تحميل الإعلان");
    currentProperty = result.data;
    fillForm(currentProperty);
    status.classList.add("success");
    if (currentProperty.status === "needs_update") {
      status.textContent = "الإعلان يحتاج تعديل. راجع ملاحظة الموظف ثم أعد الإرسال.";
    } else if (currentProperty.status === "active") {
      status.textContent = "هذا الإعلان منشور حاليًا. أي تعديل تحفظه سيحوّل الإعلان إلى تحت المراجعة مؤقتًا حتى يعتمده الموظف.";
    } else {
      status.textContent = "يمكنك تعديل الإعلان، وبعد الحفظ سيبقى تحت المراجعة حتى اعتماده.";
    }
    form.classList.remove("hidden");
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function fillForm(p) {
  const form = document.getElementById("editPropertyForm");
  form.elements.property_id.value = p.property_id || "";
  ["title","type","purpose","city","district","price","area","bedrooms","bathrooms","map_url","latitude","longitude","description"].forEach((field) => {
    if (form.elements[field]) form.elements[field].value = p[field] || "";
  });
  if (form.elements.show_price) {
    form.elements.show_price.checked = String(p.show_price || "").toLowerCase() === "yes";
  }
  const images = Array.isArray(p.images) ? p.images : [];
  document.getElementById("currentImages").innerHTML = `
    <div class="image-toolbar">
      <h3>الصور الحالية</h3>
      <span class="status-pill wait" dir="ltr">${images.length} / ${CONFIG.MAX_IMAGES_PER_PROPERTY || 10}</span>
    </div>
    <div class="admin-image-strip editable-image-strip">
      ${images.length ? images.map(img => renderEditableImage(img)).join("") : "<p>لا توجد صور.</p>"}
    </div>
    ${p.review_note ? `<div class="status-box">${escapeHtml(p.review_note)}</div>` : ""}`;
}

function renderEditableImage(img) {
  const imageId = img.image_id || img.id || "";
  const isCover = String(img.is_cover || "").toLowerCase() === "yes";
  return `
    <div class="editable-image-card ${isCover ? "cover-selected" : ""}" data-image-id="${escapeHtml(imageId)}">
      <button class="cover-star ${isCover ? "active" : ""}" type="button" onclick="setCoverImage('${escapeAttr(imageId)}')" title="اجعلها صورة الغلاف" aria-label="اجعلها صورة الغلاف" aria-pressed="${isCover ? "true" : "false"}">${isCover ? "★" : "☆"}</button>
      <img src="${escapeHtml(resolveImageUrl(img))}" onerror="this.src='https://placehold.co/800x500?text=No+Image'" />
      <button class="danger-btn image-delete-btn" type="button" onclick="deletePropertyImage('${escapeAttr(imageId)}')">حذف الصورة</button>
    </div>
  `;
}

async function submitEdit(event) {
  event.preventDefault();
  const form = event.target;
  const status = document.getElementById("editSubmitStatus");
  status.className = "status-box";
  status.textContent = "جاري حفظ التعديل...";
  status.classList.remove("hidden");
  try {
    const fd = new FormData(form);
    const files = Array.from(form.elements.images.files || []);
    const currentCount = Array.isArray(currentProperty.images) ? currentProperty.images.length : 0;
    const maxImages = CONFIG.MAX_IMAGES_PER_PROPERTY || 10;

    if (currentCount + files.length > maxImages) {
      throw new Error(`الحد الأقصى للصور هو ${maxImages}. لديك حاليًا ${currentCount} صورة، ويمكنك إضافة ${Math.max(0, maxImages - currentCount)} فقط.`);
    }

    const images = await Promise.all(files.map(fileToBase64Payload));
    const result = await authApiPost({
      action: "updateMyProperty",
      token: getAuthToken(),
      property_id: fd.get("property_id"),
      title: fd.get("title"), type: fd.get("type"), purpose: fd.get("purpose"), city: fd.get("city"), district: fd.get("district"),
      price: fd.get("price"), show_price: form.elements.show_price && form.elements.show_price.checked ? "yes" : "no", area: fd.get("area"), bedrooms: fd.get("bedrooms"), bathrooms: fd.get("bathrooms"),
      map_url: fd.get("map_url"), latitude: fd.get("latitude"), longitude: fd.get("longitude"), description: fd.get("description"),
      images
    });
    if (!result.ok) throw new Error(result.error || "فشل حفظ التعديل");
    status.classList.add("success");
    status.textContent = result.message || "تم حفظ التعديل وإرسال الإعلان للمراجعة.";
    setTimeout(() => location.href = "my-properties.html", 800);
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}


function getCurrentCoverImageId() {
  const images = Array.isArray(currentProperty && currentProperty.images) ? currentProperty.images : [];
  const cover = images.find((img) => String(img.is_cover || "").toLowerCase() === "yes");
  return cover ? (cover.image_id || cover.id || "") : "";
}

function applyCoverSelectionLocally(imageId) {
  const selectedId = String(imageId || "");
  const images = Array.isArray(currentProperty && currentProperty.images) ? currentProperty.images : [];

  images.forEach((img) => {
    const currentId = String(img.image_id || img.id || "");
    img.is_cover = currentId === selectedId ? "yes" : "no";
  });

  document.querySelectorAll(".editable-image-card").forEach((card) => {
    const isSelected = String(card.dataset.imageId || "") === selectedId;
    const button = card.querySelector(".cover-star");
    card.classList.toggle("cover-selected", isSelected);
    if (!button) return;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    button.textContent = isSelected ? "★" : "☆";
  });
}

function setCoverButtonsBusy(isBusy) {
  document.querySelectorAll(".cover-star").forEach((button) => {
    button.disabled = Boolean(isBusy);
    button.setAttribute("aria-busy", isBusy ? "true" : "false");
  });
}

async function setCoverImage(imageId) {
  if (!imageId) {
    alert("رقم الصورة غير موجود.");
    return;
  }

  if (coverImageRequestInFlight) return;

  const previousCoverId = getCurrentCoverImageId();
  if (String(previousCoverId) === String(imageId)) return;

  const status = document.getElementById("editSubmitStatus");
  coverImageRequestInFlight = true;
  applyCoverSelectionLocally(imageId);
  setCoverButtonsBusy(true);
  status.className = "status-box";
  status.textContent = "جاري حفظ صورة الغلاف...";
  status.classList.remove("hidden");

  try {
    const result = await authApiPost({
      action: "setMyPropertyCoverImage",
      token: getAuthToken(),
      property_id: currentProperty.property_id,
      image_id: imageId
    });

    if (!result.ok) throw new Error(result.error || "فشل تعيين صورة الغلاف");

    if (String(currentProperty.status || "").toLowerCase() === "active") {
      currentProperty.status = "pending";
    }

    status.classList.add("success");
    status.textContent = result.message || "تم تعيين صورة الغلاف.";
  } catch (error) {
    applyCoverSelectionLocally(previousCoverId);
    status.classList.add("error");
    status.textContent = error.message;
  } finally {
    coverImageRequestInFlight = false;
    setCoverButtonsBusy(false);
  }
}

async function deletePropertyImage(imageId) {
  if (!imageId) {
    alert("رقم الصورة غير موجود.");
    return;
  }

  const confirmed = confirm("هل تريد حذف هذه الصورة؟ سيتم حذفها من الإعلان.");
  if (!confirmed) return;

  const status = document.getElementById("editSubmitStatus");
  status.className = "status-box";
  status.textContent = "جاري حذف الصورة...";
  status.classList.remove("hidden");

  try {
    const result = await authApiPost({
      action: "deleteMyPropertyImage",
      token: getAuthToken(),
      property_id: currentProperty.property_id,
      image_id: imageId
    });

    if (!result.ok) throw new Error(result.error || "فشل حذف الصورة");

    status.classList.add("success");
    status.textContent = result.message || "تم حذف الصورة.";

    await loadPropertyForEdit();
  } catch (error) {
    status.classList.add("error");
    status.textContent = error.message;
  }
}

function escapeAttr(value) {
  return String(value ?? "").replaceAll("'", "\\'");
}

function fileToBase64Payload(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) return reject(new Error(`الصورة ${file.name} أكبر من 5MB`));
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, base64: reader.result });
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
    reader.readAsDataURL(file);
  });
}
function escapeHtml(value) { return String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

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


/* ===== Edit page multi-image queue UX v2 ===== */
let editAdditionalImageQueue = [];
function editImageFileKey(file) { return [file.name, file.size, file.lastModified, file.type].join("|"); }
function setupEditAdditionalImagesQueue() {
  const input = document.getElementById("editPropertyImagesInput") || document.querySelector('#editPropertyForm input[name="images"]');
  const clearBtn = document.getElementById("clearEditSelectedImagesBtn");
  if (!input) return;
  input.addEventListener("change", () => { addFilesToEditImageQueue(input.files); input.value = ""; });
  if (clearBtn) clearBtn.addEventListener("click", clearEditSelectedImagesQueue);
}
function addFilesToEditImageQueue(fileList) {
  const currentCount = Array.isArray(currentProperty && currentProperty.images) ? currentProperty.images.length : 0;
  const maxImages = CONFIG.MAX_IMAGES_PER_PROPERTY || 10;
  const available = Math.max(0, maxImages - currentCount);
  const seen = new Set(editAdditionalImageQueue.map(editImageFileKey));
  let skipped = 0;
  Array.from(fileList || []).forEach((file) => {
    const key = editImageFileKey(file);
    if (seen.has(key)) return;
    if (editAdditionalImageQueue.length >= available) { skipped += 1; return; }
    editAdditionalImageQueue.push(file); seen.add(key);
  });
  if (skipped) alert(`يمكنك إضافة ${available} صور فقط قبل الوصول إلى الحد الأقصى ${maxImages}.`);
  renderEditSelectedImagesQueue();
}
function removeEditSelectedImage(index) { editAdditionalImageQueue.splice(Number(index), 1); renderEditSelectedImagesQueue(); }
function renderEditSelectedImagesQueue() {
  const wrapper = document.getElementById("editSelectedImagesPreview"), grid = document.getElementById("editSelectedImagesGrid"), count = document.getElementById("editSelectedImagesCount");
  if (!wrapper || !grid || !count) return;
  const currentCount = Array.isArray(currentProperty && currentProperty.images) ? currentProperty.images.length : 0;
  const maxImages = CONFIG.MAX_IMAGES_PER_PROPERTY || 10;
  count.textContent = `${currentCount + editAdditionalImageQueue.length} / ${maxImages}`;
  grid.innerHTML = "";
  if (!editAdditionalImageQueue.length) { wrapper.classList.add("hidden"); return; }
  editAdditionalImageQueue.forEach((file, index) => {
    const card = document.createElement("div"); card.className = "selected-image-card";
    const img = document.createElement("img"); img.src = URL.createObjectURL(file); img.alt = file.name;
    const meta = document.createElement("div"); meta.className = "selected-image-meta"; meta.textContent = `${index + 1}. ${file.name}`;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "danger-btn selected-image-remove-btn"; btn.textContent = "إزالة"; btn.addEventListener("click", () => removeEditSelectedImage(index));
    card.append(img, meta, btn); grid.appendChild(card);
  });
  wrapper.classList.remove("hidden");
}
function clearEditSelectedImagesQueue() {
  editAdditionalImageQueue = [];
  const input = document.getElementById("editPropertyImagesInput") || document.querySelector('#editPropertyForm input[name="images"]');
  if (input) input.value = "";
  renderEditSelectedImagesQueue();
}

document.addEventListener("DOMContentLoaded", setupEditAdditionalImagesQueue);

async function submitEdit(event) {
  event.preventDefault();
  const form = event.target;
  const status = document.getElementById("editSubmitStatus");
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  status.className = "status-box";
  status.textContent = "جاري حفظ التعديل ورفع الصور دفعة واحدة...";
  status.classList.remove("hidden");
  try {
    const fd = new FormData(form);
    const currentCount = Array.isArray(currentProperty.images) ? currentProperty.images.length : 0;
    const maxImages = CONFIG.MAX_IMAGES_PER_PROPERTY || 10;
    if (currentCount + editAdditionalImageQueue.length > maxImages) throw new Error(`الحد الأقصى للصور هو ${maxImages}.`);
    const images = await Promise.all(editAdditionalImageQueue.map(fileToBase64Payload));
    const result = await authApiPost({
      action: "updateMyProperty", token: getAuthToken(), property_id: fd.get("property_id"),
      title: fd.get("title"), type: fd.get("type"), purpose: fd.get("purpose"), city: fd.get("city"), district: fd.get("district"),
      price: fd.get("price"), show_price: form.elements.show_price && form.elements.show_price.checked ? "yes" : "no", area: fd.get("area"), bedrooms: fd.get("bedrooms"), bathrooms: fd.get("bathrooms"),
      map_url: fd.get("map_url"), latitude: fd.get("latitude"), longitude: fd.get("longitude"), description: fd.get("description"), images
    });
    if (!result.ok) throw new Error(result.error || "فشل حفظ التعديل");
    status.classList.add("success"); status.textContent = result.message || "تم حفظ التعديل وإرسال الإعلان للمراجعة.";
    clearEditSelectedImagesQueue();
    setTimeout(() => location.href = "my-properties.html", 800);
  } catch (error) { status.classList.add("error"); status.textContent = error.message; }
  finally { if (submitButton) submitButton.disabled = false; }
}
