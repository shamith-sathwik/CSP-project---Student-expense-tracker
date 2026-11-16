const CURRENT_USER_KEY = "studentCurrentUser";
const currentUser = JSON.parse(localStorage.getItem(CURRENT_USER_KEY));
const $ = (id) => document.getElementById(id);

if (!currentUser || !currentUser.isAdmin) {
    window.location.href = "login.html";
}

$("adminLogoutBtn").addEventListener("click", () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.location.href = "login.html";
});

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);
}

async function loadAccounts() {
    let users = [];

    try {
        const res = await fetch("/api/admin/users");
        if (!res.ok) throw new Error();
        const data = await res.json();
        users = data.users;
    } catch (err) {
        const localUsers = JSON.parse(localStorage.getItem("studentUsers") || "[]");
        users = localUsers.map((u, idx) => {
            const userExpenses = JSON.parse(localStorage.getItem(`studentExpenses_${u.username}`) || "[]");
            return {
                id: u.id || idx + 1,
                username: u.username,
                email: u.email,
                password: u.password,
                expense_count: userExpenses.length
            };
        });
    }

    $("userCount").textContent = users.length;
    $("noAccountsState").hidden = users.length > 0;

    $("accountsTableBody").innerHTML = users.map(u => `
        <tr>
            <td>#${escapeHTML(u.id)}</td>
            <td><strong>${escapeHTML(u.username)}</strong></td>
            <td>${escapeHTML(u.email)}</td>
            <td><span class="pwd-badge">${escapeHTML(u.password)}</span></td>
            <td>${escapeHTML(u.expense_count ?? 0)} items</td>
        </tr>
    `).join("");
}

$("refreshUsersBtn").addEventListener("click", loadAccounts);

loadAccounts();