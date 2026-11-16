const CURRENT_USER_KEY = "studentCurrentUser";
const currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY));

if (!currentUser) {
    window.location.href = "login.html";
}

const STORAGE_KEY = `studentExpenses_${currentUser ? currentUser.username : "guest"}`;
const BUDGET_KEY = `studentBudgets_${currentUser ? currentUser.username : "guest"}`;

const $ = (id) => document.getElementById(id);

let expenses = [];
let budgets = {};

const today = new Date();

function localDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function monthKey(date) {
    return date.slice(0, 7);
}

$("monthFilter").value = monthKey(localDate(today));
$("date").value = localDate(today);
$("userDisplay").textContent = currentUser ? `👤 ${currentUser.username}` : "";

$("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = "login.html";
});

let categoryChart;
let barChart;

function money(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
}

function selectedMonth() {
    return $("monthFilter").value;
}

function monthExpenses() {
    return expenses.filter(e => monthKey(e.date) === selectedMonth());
}

function budgetForMonth() {
    return Number(budgets[selectedMonth()] ?? 5000);
}

async function loadData() {
    try {
        const res = await fetch(`/api/data?user_id=${currentUser.id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        expenses = data.expenses;
        budgets = data.budgets;
    } catch (err) {
        expenses = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        budgets = JSON.parse(localStorage.getItem(BUDGET_KEY) || "{}");
    }
    render();
}

function saveFallback() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
    localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}

function render() {
    const list = monthExpenses().sort((a, b) => b.date.localeCompare(a.date));
    const total = list.reduce((sum, e) => sum + e.amount, 0);
    const budget = budgetForMonth();
    const remaining = budget - total;

    $("totalSpent").textContent = money(total);
    $("budgetValue").textContent = money(budget);
    $("remaining").textContent = money(remaining);
    $("remaining").style.color = remaining < 0 ? "red" : "green";

    $("budgetInput").value = budget;
    $("budgetProgress").style.width = Math.min(budget > 0 ? (total / budget) * 100 : 0, 100) + "%";
    $("budgetProgress").style.background = total > budget ? "red" : "#5146df";
    $("budgetMessage").textContent = total > budget
        ? `You are ${money(total - budget)} over budget.`
        : `${money(remaining)} remaining.`;

    $("emptyState").hidden = list.length > 0;

    $("expenseList").innerHTML = list.map(e => `
        <div class="expense-item">
            <div>
                <div class="expense-date">${e.date}</div>
                <div class="expense-title">${escapeHTML(e.category)}</div>
                <div class="expense-note">${escapeHTML(e.note || "No note")}</div>
            </div>
            <div>
                <div class="expense-amount">- ${money(e.amount)}</div>
                <button class="delete-btn" data-delete="${e.id}">Delete</button>
            </div>
        </div>
    `).join("");

    renderCharts(list);
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

function renderCharts(list) {
    const categories = ["Food", "Hostel", "Travel", "Shopping", "Entertainment", "Education", "Other"];
    const totals = categories.map(category =>
        list.filter(e => e.category === category).reduce((sum, e) => sum + e.amount, 0)
    );

    if (categoryChart) categoryChart.destroy();
    if (barChart) barChart.destroy();

    categoryChart = new Chart($("categoryChart"), {
        type: "doughnut",
        data: {
            labels: categories,
            datasets: [{
                data: totals,
                backgroundColor: ["#5146df", "#13b887", "#f4a340", "#e65c78", "#55a6d9", "#9b70d5", "#aab0c4"],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "65%",
            plugins: { legend: { position: "bottom" } }
        }
    });

    barChart = new Chart($("barChart"), {
        type: "bar",
        data: {
            labels: categories,
            datasets: [{
                label: "Expenses",
                data: totals,
                backgroundColor: "#5146df",
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

$("expenseForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const amount = Number($("amount").value);
    const date = $("date").value;

    if (!Number.isFinite(amount) || amount <= 0 || !date) {
        $("formMessage").textContent = "Enter a valid amount and date.";
        return;
    }

    const payload = {
        user_id: currentUser.id,
        category: $("category").value,
        amount: amount,
        date: date,
        note: $("note").value.trim()
    };

    try {
        const res = await fetch("/api/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error();
        const savedExpense = await res.json();
        expenses.push(savedExpense);
    } catch (err) {
        expenses.push({ id: Date.now(), ...payload });
        saveFallback();
    }

    $("expenseForm").reset();
    $("date").value = localDate(today);
    $("formMessage").textContent = "Expense saved successfully!";
    render();
});

$("expenseList").addEventListener("click", async function(event) {
    const id = Number(event.target.dataset.delete);
    if (!id) return;

    try {
        await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    } catch (err) {}

    expenses = expenses.filter(e => e.id !== id);
    saveFallback();
    render();
});

$("saveBudget").addEventListener("click", async function() {
    const value = Number($("budgetInput").value);
    if (!Number.isFinite(value) || value < 0) {
        alert("Enter a valid budget.");
        return;
    }

    const month = selectedMonth();
    budgets[month] = value;

    try {
        await fetch("/api/budgets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: currentUser.id, month, amount: value })
        });
    } catch (err) {
        saveFallback();
    }

    render();
});

$("monthFilter").addEventListener("change", render);

$("downloadReport").addEventListener("click", function() {
    const list = monthExpenses();
    const rows = [
        ["Date", "Category", "Amount (INR)", "Note"],
        ...list.map(e => [e.date, e.category, e.amount, e.note || ""])
    ];

    const csv = rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expense-report-${selectedMonth()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

loadData();