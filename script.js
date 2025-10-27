async function loadPage() {
  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get("page")) || 1;
  const csvFile = `data/page_${page}.csv`;
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "<p>Đang tải...</p>";

  try {
    const res = await fetch(csvFile + "?_=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const text = await res.text();

    const rows = text.trim().split("\n");
    let headers = rows[0].replace(/\uFEFF/g, "").split("|").map(h => h.trim());
    const dataIndex = headers.indexOf("data");
    if (dataIndex === -1) throw new Error("Không tìm thấy cột 'data' trong file CSV.");

    gallery.innerHTML = "";

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue;
      const cols = rows[i].split("|");

      // Nếu số cột ít hơn headers, bỏ qua
      if (cols.length < headers.length) {
        console.warn("Dòng thiếu dữ liệu:", rows[i]);
        continue;
      }

      const record = Object.fromEntries(headers.map((h, j) => [h, cols[j]?.trim()]));
      const rawData = record.data;

      let data = {};
      try {
        if (rawData) {
          const cleaned = rawData.replaceAll('""', '"').replace(/(^")|("$)/g, "");
          data = JSON.parse(cleaned);
        } else {
          console.warn("Thiếu cột data ở dòng", i + 1);
        }
      } catch (e) {
        console.warn("Lỗi parse JSON ở dòng", i + 1, e);
      }

      const imgSrc = data.url_max_2000 || data.url_max;
      if (!imgSrc) continue;

      // ---- TẠO CARD (DOM) ----
      const card = document.createElement("div");
      card.className = "card";

      // IMG
      const img = document.createElement("img");
      img.src = imgSrc;
      img.alt = data.title || "";
      img.className = "card-img";
      // Khi ảnh lỗi
      img.onerror = () => {
        img.style.opacity = "0.6";
        img.alt = "Image not available";
      };

      // INFO luôn hiện (title, camera, lens_model, realname)
      const info = document.createElement("div");
      info.className = "info";
      const titleEl = document.createElement("strong");
      titleEl.textContent = data.title || "(No title)";
      const br = document.createElement("br");
      const cameraSmall = document.createElement("small");
      // show camera on first line, lens_model on its own line below
      cameraSmall.innerHTML = `${escapeHtml(data.camera || "")}`;
      const lensLine = document.createElement("div");
      lensLine.className = "lens-line";
      lensLine.innerHTML = `<small>Lens: ${escapeHtml(data.lens_model || "Không rõ")}</small>`;
      const ownerSmall = document.createElement("small");
      ownerSmall.style.display = "block";
      ownerSmall.textContent = data.realname || "";

      info.appendChild(titleEl);
      info.appendChild(br);
      info.appendChild(cameraSmall);
      info.appendChild(lensLine);
      info.appendChild(ownerSmall);

      // DETAIL: ẩn mặc định, hiện khi hover/click (xuất hiện bên dưới ảnh)
      const detail = document.createElement("div");
      detail.className = "detail"; // CSS: .detail { max-height:0; overflow:hidden; transition... }
      detail.innerHTML = `
        <div><strong>Camera:</strong> ${escapeHtml(data.camera || "")}</div>
        ${data.lens_model ? `<div><strong>Lens:</strong> ${escapeHtml(data.lens_model)}</div>` : ""}
        <div><strong>ISO:</strong> ${escapeHtml(data.iso || "")}</div>
        <div><strong>Aperture:</strong> ${escapeHtml(data.aperture || "")}</div>
        <div><strong>Exposure:</strong> ${escapeHtml(data.exposure_time || "")}</div>
        <div><strong>Focal:</strong> ${escapeHtml(data.focal_length || "")}</div>
        <div><strong>Taken:</strong> ${escapeHtml(data.datetaken || "")}</div>
      `;

      // Append children
      card.appendChild(img);
      card.appendChild(info);
      
    const buttonBox = document.createElement("div");
    buttonBox.className = "button-box";
      // --- Thêm nút Save ---
    const saveBtn = document.createElement("button");
    saveBtn.className = "save-btn";
    saveBtn.textContent = "Save";
    saveBtn.dataset.data = JSON.stringify(data)

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open";
    openBtn.className = "open-btn";
    openBtn.onclick = (e) => {
    e.stopPropagation(); // tránh toggle detail
    const imgUrl = data.url_max;
    if (imgUrl) {
        window.open(imgUrl, "_blank");
    } else {
        alert("Không có ảnh gốc để mở!");
    }
    };

    // Gắn 2 nút vào box
    buttonBox.appendChild(saveBtn);
    buttonBox.appendChild(openBtn);

    // Gắn box này vào card
    card.appendChild(buttonBox);

    card.appendChild(detail);


      // ---- Sự kiện hover / touch để show detail dưới ảnh ----
      // mouseenter/mouseleave cho desktop
      card.addEventListener("mouseenter", () => {
        detail.classList.add("show-detail");
      });
      card.addEventListener("mouseleave", () => {
        detail.classList.remove("show-detail");
      });

      // click để toggle (hữu ích cho touch devices)
      card.addEventListener("click", (ev) => {
        // nếu bấm vào nút trong modal (nếu có), tránh xung đột
        // cũng cho phép click vào ảnh để open modal: nếu nhấn giữ Ctrl/Meta thì open modal
        if (ev.target.tagName.toLowerCase() === "img" && (ev.ctrlKey || ev.metaKey)) {
          openModal(data);
          return;
        }
        // toggle detail
        if (detail.classList.contains("show-detail")) detail.classList.remove("show-detail");
        else detail.classList.add("show-detail");
      });

      // double click as alternative to open modal
      card.addEventListener("dblclick", () => openModal(data));

      // add to gallery
      gallery.appendChild(card);
    }

    createPagination(page);
  } catch (err) {
    console.error("Lỗi đọc CSV:", err);
    gallery.innerHTML = `<p style="color:red">Lỗi tải dữ liệu: ${escapeHtml(err.message)}</p>`;
  }
}


function createPagination(currentPage) {
  const totalPages = CONFIG.total_pages || 1; // 👈 chỉnh lại đúng số trang tối đa bạn có
  const container = document.getElementById("pagination");
  container.innerHTML = "";

  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);

  // Nếu ở cuối danh sách
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }

  // Nút về đầu
  if (currentPage > 1) {
    const first = document.createElement("button");
    first.textContent = "«";
    first.onclick = () => goToPage(1);
    container.appendChild(first);

    const prev = document.createElement("button");
    prev.textContent = "<";
    prev.onclick = () => goToPage(currentPage - 1);
    container.appendChild(prev);
  }

  // Các trang gần nhất
  for (let i = start; i <= end; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active");
    btn.onclick = () => goToPage(i);
    container.appendChild(btn);
  }

  // Trang cuối cùng
  if (end < totalPages) {
    const dots = document.createElement("span");
    dots.textContent = "...";
    dots.classList.add("dots");
    container.appendChild(dots);

    const last = document.createElement("button");
    last.textContent = totalPages;
    last.onclick = () => goToPage(totalPages);
    container.appendChild(last);
  }

  // Nút tiếp theo & cuối
  if (currentPage < totalPages) {
    const next = document.createElement("button");
    next.textContent = ">";
    next.onclick = () => goToPage(currentPage + 1);
    container.appendChild(next);

    const last = document.createElement("button");
    last.textContent = "»";
    last.onclick = () => goToPage(totalPages);
    container.appendChild(last);
  }

  // Ô nhập nhảy trang
  const jumpBox = document.createElement("div");
  jumpBox.className = "jump-box";
  jumpBox.innerHTML = `
    <span>Đi tới trang:</span>
    <input type="number" id="jumpInput" min="1" max="${totalPages}" style="width:60px; margin:0 5px;">
    <button id="jumpBtn">Go</button>
  `;
  container.appendChild(jumpBox);

  document.getElementById("jumpBtn").onclick = () => {
    const val = parseInt(document.getElementById("jumpInput").value);
    if (val >= 1 && val <= totalPages) {
      goToPage(val);
    } else {
      alert("Số trang không hợp lệ!");
    }
  };
}

function goToPage(page) {
  window.location.href = `index.html?page=${page}`;
}


// Modal logic
const modal = document.getElementById("modal");
const modalImg = document.getElementById("modalImg");
const modalInfo = document.getElementById("modalInfo");
const closeModal = document.getElementById("closeModal");

function openModal(data) {
  modalImg.src = data.url_max || data.url_max_2000;
  modalInfo.innerHTML = `
    <h3>${escapeHtml(data.title || "")}</h3>
    <p><strong>Tác giả:</strong> ${escapeHtml(data.realname || "")}</p>
    <p><strong>Camera:</strong> ${escapeHtml(data.camera || "")}</p>
    <p><strong>Lens:</strong> ${escapeHtml(data.lens_model || "")}</p>
    <p><strong>ISO:</strong> ${escapeHtml(data.iso || "")}</p>
    <p><strong>Aperture:</strong> ${escapeHtml(data.aperture || "")}</p>
    <p><strong>Focal Length:</strong> ${escapeHtml(data.focal_length || "")}</p>
    <p><a href="${escapeHtml(data.flickr_page || '#')}" target="_blank">Xem trên Flickr</a></p>
  `;
  modal.style.display = "flex";
}

closeModal.onclick = () => (modal.style.display = "none");
window.onclick = (e) => {
  if (e.target === modal) modal.style.display = "none";
};


document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("save-btn")) {
    const btn = e.target;
    
    const payload = {
      web_query: {
        data: btn.dataset.data,
      },
    };

    btn.disabled = true;
    btn.textContent = "⏳ Saving...";

    try {
      const res = await fetch(CONFIG.api_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        btn.textContent = "✅ Saved";
      } else {
        console.error("Server error:", res.status, res.statusText);
        btn.textContent = "⚠️ Retry";
        btn.disabled = false;
      }
    } catch (err) {
      console.error("Lỗi gửi request:", err);
      btn.textContent = "❌ Error";
      btn.disabled = false;
    }
  }
});

let CONFIG = {
  title: "Default Title",
  total_pages: 1,
  api_url: "",
};

async function loadConfig() {
  try {
    const res = await fetch("config.txt?_=" + Date.now());
    if (!res.ok) throw new Error("Không đọc được file config.txt");

    const text = await res.text();
    text.split("\n").forEach(line => {
      const [key, value] = line.split("=").map(x => x.trim());
      if (!key || !value) return;
      if (key === "total_pages") CONFIG.total_pages = parseInt(value);
      else CONFIG[key] = value;
    });

    // Đặt title web
    document.title = CONFIG.title;
    const h1 = document.querySelector("h1");
    if (h1) h1.textContent = CONFIG.title;

    // Sau khi có config mới load dữ liệu
    loadPage();
  } catch (err) {
    console.error("Lỗi load config:", err);
    alert("Không thể tải cấu hình trang!");
  }
}

loadConfig();


// Utility: escape HTML
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
