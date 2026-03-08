const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2yrRpyHGbd4fOoEaW995KltoXHLpozI9UKNKt2dITY131GAbNqg2CWAcjJ9Nt52u2j4847eOYie_J/pub?gid=271143107&single=true&output=csv";

const propertiesContainer = document.getElementById("propertiesContainer");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

let allProperties = [];

async function loadProperties() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
      throw new Error("فشل تحميل ملف CSV");
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);

    allProperties = rows
      .map(mapRowToProperty)
      .filter((property) => isVisible(property));

    renderProperties(allProperties);

    loadingMessage.classList.add("hidden");
  } catch (error) {
    console.error("Load Error:", error);
    loadingMessage.classList.add("hidden");
    errorMessage.classList.remove("hidden");
  }
}

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitCSVLine(line);
    const rowObject = {};

    headers.forEach((header, index) => {
      rowObject[header] = (values[index] || "").trim();
    });

    return rowObject;
  });
}

function splitCSVLine(line) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function mapRowToProperty(row) {
  return {
    id: row.id || "",
    title: row.title || "بدون عنوان",
    category: row.category || "غير محدد",
    city: row.city || "غير محدد",
    district: row.district || "غير محدد",
    area: row.area || "-",
    length: row.length || "-",
    width: row.width || "-",
    price: row.price || "0",
    price_type: row.price_type || "price",
    description: row.description || "",
    image_url: row.image_url || "",
    is_visible: row.is_visible || "FALSE",
  };
}

function isVisible(property) {
  return String(property.is_visible).toUpperCase() === "TRUE";
}

function formatPrice(property) {
  if (property.price_type === "sum") {
    return "السوم";
  }

  const numericPrice = Number(property.price);
  if (!numericPrice) {
    return "غير محدد";
  }

  return `${numericPrice.toLocaleString("en-US")} ريال`;
}

function getImageUrl(imageUrl) {
  if (!imageUrl) {
    return "https://picsum.photos/600/400?random=20";
  }
  return imageUrl;
}

function createPropertyCard(property) {
  return `
    <article class="property-card">
      <img
        class="property-image"
        src="${getImageUrl(property.image_url)}"
        alt="${property.title}"
        onerror="this.src='https://picsum.photos/600/400?random=99'"
      />
      <div class="property-content">
        <span class="badge">${property.category}</span>
        <h3 class="property-title">${property.title}</h3>

        <div class="property-meta">
          <div><strong>المدينة:</strong> ${property.city}</div>
          <div><strong>الحي:</strong> ${property.district}</div>
          <div><strong>المساحة:</strong> ${property.area} م²</div>
          <div><strong>الأبعاد:</strong> ${property.length} × ${property.width}</div>
        </div>

        <p class="property-description">${property.description}</p>

        <div class="property-price">${formatPrice(property)}</div>
      </div>
    </article>
  `;
}

function renderProperties(properties) {
  if (!properties.length) {
    propertiesContainer.innerHTML = `
      <div class="empty-box">
        لا توجد عقارات مطابقة حاليًا.
      </div>
    `;
    return;
  }

  propertiesContainer.innerHTML = properties
    .map((property) => createPropertyCard(property))
    .join("");
}

function applyFilters() {
  const searchValue = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value.trim();

  const filtered = allProperties.filter((property) => {
    const matchesSearch =
      property.title.toLowerCase().includes(searchValue) ||
      property.city.toLowerCase().includes(searchValue) ||
      property.district.toLowerCase().includes(searchValue);

    const matchesCategory =
      !selectedCategory || property.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  renderProperties(filtered);
}

searchInput.addEventListener("input", applyFilters);
categoryFilter.addEventListener("change", applyFilters);

loadProperties();