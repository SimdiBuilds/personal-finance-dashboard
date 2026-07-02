// ── State ────────────────────────────────────────────────────────

let categoryChart = null;
let monthChart = null;
let allTransactions = [];

const CATEGORY_COLORS = {
  "Food & Dining": "#0B6E4F",
  "Transport": "#2E6F9E",
  "Shopping": "#A15C07",
  "Entertainment": "#7A4FA3",
  "Utilities": "#4A463F",
  "Health": "#A3341F",
  "Housing": "#B48A17",
  "Income": "#0B6E4F",
  "Other": "#8B8577",
};

function categoryColor(name) {
  return CATEGORY_COLORS[name] || "#8B8577";
}

// ── View switching ───────────────────────────────────────────────

const views = {
  empty: document.getElementById("emptyState"),
  loading: document.getElementById("loadingState"),
  dashboard: document.getElementById("dashboard"),
};

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

// ── Upload handling (shared by empty state + modal) ────────────────

async function uploadFile(file) {
  if (!file || !file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Please upload a .csv file.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "That file could not be processed.");
  }

  return data;
}

async function useSampleData() {
  const res = await fetch("/load-sample", { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Could not load sample data.");
  }

  return data;
}

function wireDropzone({ dropzoneEl, inputEl, errorEl, onFile }) {
  const showError = (msg) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  };
  const clearError = () => { errorEl.hidden = true; };

  inputEl.addEventListener("change", (e) => {
    clearError();
    const file = e.target.files[0];
    if (file) onFile(file).catch((err) => showError(err.message));
  });

  dropzoneEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzoneEl.classList.add("dragover");
  });

  dropzoneEl.addEventListener("dragleave", () => {
    dropzoneEl.classList.remove("dragover");
  });

  dropzoneEl.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzoneEl.classList.remove("dragover");
    clearError();
    const file = e.dataTransfer.files[0];
    if (file) onFile(file).catch((err) => showError(err.message));
  });

  return { showError, clearError };
}

// ── Empty state wiring ─────────────────────────────────────────────

const emptyError = document.getElementById("uploadErrorEmpty");

const emptyDropzone = wireDropzone({
  dropzoneEl: document.getElementById("dropzoneEmpty"),
  inputEl: document.getElementById("fileInputEmpty"),
  errorEl: emptyError,
  onFile: async (file) => {
    showView("loading");
    try {
      await uploadFile(file);
      await loadDashboard();
    } catch (err) {
      showView("empty");
      emptyError.textContent = err.message;
      emptyError.hidden = false;
    }
  },
});

document.getElementById("sampleBtnEmpty").addEventListener("click", async () => {
  emptyError.hidden = true;
  showView("loading");
  try {
    await useSampleData();
    await loadDashboard();
  } catch (err) {
    showView("empty");
    emptyError.textContent = err.message;
    emptyError.hidden = false;
  }
});

// ── Modal (replace data) wiring ─────────────────────────────────────

const modalOverlay = document.getElementById("modalOverlay");
const modalError = document.getElementById("uploadErrorModal");

function openModal() {
  modalError.hidden = true;
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
}

document.getElementById("replaceDataBtn").addEventListener("click", openModal);
document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

wireDropzone({
  dropzoneEl: document.getElementById("dropzoneModal"),
  inputEl: document.getElementById("fileInputModal"),
  errorEl: modalError,
  onFile: async (file) => {
    modalError.hidden = true;
    try {
      await uploadFile(file);
      closeModal();
      await loadDashboard();
    } catch (err) {
      modalError.textContent = err.message;
      modalError.hidden = false;
      throw err;
    }
  },
});

// ── Dashboard data + rendering ───────────────────────────────────────

async function loadDashboard() {
  const [summary, byCategory, byMonth, transactions] = await Promise.all([
    fetch("/summary").then((r) => r.json()),
    fetch("/by-category").then((r) => r.json()),
    fetch("/by-month").then((r) => r.json()),
    fetch("/transactions").then((r) => r.json()),
  ]);

  allTransactions = transactions;

  // Reveal the dashboard first. Everything after this point is best-effort —
  // a chart failing to render should never hide the data that's already loaded.
  showView("dashboard");

  renderMeta(transactions.length);
  renderStats(summary);
  renderTable(transactions);

  try {
    renderCategoryChart(byCategory);
    renderMonthChart(byMonth);
  } catch (err) {
    console.error("Chart rendering failed:", err);
  }
}

function formatCurrency(n) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderMeta(count) {
  const now = new Date();
  const timestamp = now.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  document.getElementById("pageMeta").textContent = `${count} transactions · updated ${timestamp}`;
}

function renderStats(summary) {
  document.getElementById("statIncome").textContent = formatCurrency(summary.total_income);
  document.getElementById("statExpenses").textContent = formatCurrency(summary.total_expenses);
  document.getElementById("statBalance").textContent = formatCurrency(summary.net_balance);
}

function renderCategoryChart(data) {
  const canvas = document.getElementById("categoryChart");
  if (categoryChart) categoryChart.destroy();

  if (typeof Chart === "undefined") {
    console.error("Chart.js did not load — skipping category chart.");
    return;
  }

  categoryChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: data.map((d) => d.category),
      datasets: [{
        data: data.map((d) => d.total),
        backgroundColor: data.map((d) => categoryColor(d.category)),
        borderWidth: 2,
        borderColor: "#FFFFFF",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "right",
          labels: {
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 11, family: "Inter" },
            padding: 12,
            color: "#5C574C",
          },
        },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}` },
        },
      },
    },
  });
}

function renderMonthChart(data) {
  const canvas = document.getElementById("monthChart");
  if (monthChart) monthChart.destroy();

  if (typeof Chart === "undefined") {
    console.error("Chart.js did not load — skipping month chart.");
    return;
  }

  monthChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: data.map((d) => d.month),
      datasets: [
        { label: "Income", data: data.map((d) => d.income), backgroundColor: "#0B6E4F", borderRadius: 3, maxBarThickness: 28 },
        { label: "Expenses", data: data.map((d) => d.expenses), backgroundColor: "#A3341F", borderRadius: 3, maxBarThickness: 28 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle", font: { size: 11, family: "Inter" }, color: "#5C574C" },
        },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` },
        },
      },
      scales: {
        y: {
          ticks: { callback: (v) => "$" + v.toLocaleString(), font: { size: 10.5, family: "JetBrains Mono" }, color: "#8B8577" },
          grid: { color: "#EFEBE0" },
          border: { display: false },
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11, family: "Inter" }, color: "#5C574C" },
          border: { color: "#E7E2D6" },
        },
      },
    },
  });
}

function renderTable(transactions) {
  const tbody = document.getElementById("txnTableBody");
  tbody.innerHTML = "";

  transactions.forEach((t) => {
    const row = document.createElement("tr");
    const isIncome = t.type === "income";
    const sign = isIncome ? "+" : "\u2212";
    const amountClass = isIncome ? "gain" : "loss";

    row.innerHTML = `
      <td>${t.date}</td>
      <td>${t.description}</td>
      <td>
        <span class="category-tag">
          <span class="category-dot" style="background:${categoryColor(t.category)}"></span>
          ${t.category}
        </span>
      </td>
      <td class="cell-amount ${amountClass}">${sign}${formatCurrency(t.amount)}</td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allTransactions.filter(
    (t) => t.description.toLowerCase().includes(query) || t.category.toLowerCase().includes(query)
  );
  renderTable(filtered);
});