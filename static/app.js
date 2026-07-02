const uploadZone = document.getElementById("uploadZone");
const loadingState = document.getElementById("loadingState");
const dashboard = document.getElementById("dashboard");
const fileInput = document.getElementById("fileInput");
const dropArea = document.getElementById("dropArea");
const uploadError = document.getElementById("uploadError");
const uploadAgainBtn = document.getElementById("uploadAgainBtn");
const uploadNewBtn = document.getElementById("uploadNewBtn");

function showView(view) {
  uploadZone.hidden = view !== "upload";
  loadingState.hidden = view !== "loading";
  dashboard.hidden = view !== "dashboard";
}

function showError(message) {
  uploadError.textContent = message;
  uploadError.hidden = false;
}

async function handleFile(file) {
  if (!file || !file.name.endsWith(".csv")) {
    showError("Please upload a valid .csv file.");
    return;
  }

  uploadError.hidden = true;
  showView("loading");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/upload", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      showView("upload");
      showError(data.error || "Something went wrong uploading that file.");
      return;
    }

    await loadDashboard();
  } catch (err) {
    showView("upload");
    showError("Could not reach the server. Is it running?");
  }
}

fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

dropArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropArea.classList.add("dragover");
});

dropArea.addEventListener("dragleave", () => dropArea.classList.remove("dragover"));

dropArea.addEventListener("drop", (e) => {
  e.preventDefault();
  dropArea.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  handleFile(file);
});

uploadAgainBtn.addEventListener("click", () => showView("upload"));
uploadNewBtn.addEventListener("click", () => showView("upload"));

// ── Dashboard population ─────────────────────────────────────────

let categoryChart = null;
let monthChart = null;
let allTransactions = [];

async function loadDashboard() {
  const [summary, byCategory, byMonth, transactions] = await Promise.all([
    fetch("/summary").then((r) => r.json()),
    fetch("/by-category").then((r) => r.json()),
    fetch("/by-month").then((r) => r.json()),
    fetch("/transactions").then((r) => r.json()),
  ]);

  allTransactions = transactions;

  renderStats(summary);
  renderCategoryChart(byCategory);
  renderMonthChart(byMonth);
  renderTable(transactions);

  showView("dashboard");
}

function formatCurrency(n) {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderStats(summary) {
  document.getElementById("statIncome").textContent = formatCurrency(summary.total_income);
  document.getElementById("statExpenses").textContent = formatCurrency(summary.total_expenses);
  document.getElementById("statBalance").textContent = formatCurrency(summary.net_balance);

  const balanceCard = document.getElementById("balanceCard");
  balanceCard.classList.toggle("negative", summary.net_balance < 0);
}

const CATEGORY_COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#6366F1",
];

function renderCategoryChart(data) {
  const ctx = document.getElementById("categoryChart");
  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: data.map((d) => d.category),
      datasets: [{
        data: data.map((d) => d.total),
        backgroundColor: CATEGORY_COLORS,
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, font: { size: 11.5 }, padding: 12 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  });
}

function renderMonthChart(data) {
  const ctx = document.getElementById("monthChart");
  if (monthChart) monthChart.destroy();

  monthChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map((d) => d.month),
      datasets: [
        {
          label: "Income",
          data: data.map((d) => d.income),
          backgroundColor: "#10B981",
          borderRadius: 6,
        },
        {
          label: "Expenses",
          data: data.map((d) => d.expenses),
          backgroundColor: "#EF4444",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12, font: { size: 11.5 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
      scales: {
        y: {
          ticks: { callback: (v) => "$" + v.toLocaleString() },
          grid: { color: "#F1F5F9" },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderTable(transactions) {
  const tbody = document.getElementById("txnTableBody");
  tbody.innerHTML = "";

  transactions.forEach((t) => {
    const row = document.createElement("tr");
    const sign = t.type === "income" ? "+" : "-";
    const amountClass = t.type === "income" ? "amount-income" : "amount-expense";

    row.innerHTML = `
      <td>${t.date}</td>
      <td>${t.description}</td>
      <td><span class="category-pill">${t.category}</span></td>
      <td class="align-right ${amountClass}">${sign}${formatCurrency(t.amount)}</td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById("searchInput").addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allTransactions.filter(
    (t) =>
      t.description.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
  );
  renderTable(filtered);
});