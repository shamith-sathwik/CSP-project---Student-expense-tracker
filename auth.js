const CURRENT_USER_KEY = "studentCurrentUser";
const $ = (id) => document.getElementById(id);

if ($("registerForm")) {
    $("registerForm").addEventListener("submit", async function(e) {
        e.preventDefault();
        
        const username = $("regUsername").value.trim();
        const email = $("regEmail").value.trim();
        const password = $("regPassword").value;

        if (username.toLowerCase() === "admin") {
            $("regMessage").textContent = "Username 'admin' is reserved.";
            $("regMessage").style.color = "var(--red)";
            return;
        }

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();

            if (!res.ok) {
                $("regMessage").textContent = data.error || "Registration failed.";
                $("regMessage").style.color = "var(--red)";
                return;
            }

            $("regMessage").textContent = "Registration successful! Redirecting to login...";
            $("regMessage").style.color = "var(--green)";
            setTimeout(() => { window.location.href = "login.html"; }, 1200);
        } catch (err) {
            let users = JSON.parse(localStorage.getItem("studentUsers") || "[]");
            if (users.find(u => u.username === username)) {
                $("regMessage").textContent = "Username already exists.";
                $("regMessage").style.color = "var(--red)";
                return;
            }
            users.push({ id: Date.now(), username, email, password });
            localStorage.setItem("studentUsers", JSON.stringify(users));
            $("regMessage").textContent = "Registration successful! Redirecting...";
            $("regMessage").style.color = "var(--green)";
            setTimeout(() => { window.location.href = "login.html"; }, 1200);
        }
    });
}

if ($("loginForm")) {
    $("loginForm").addEventListener("submit", async function(e) {
        e.preventDefault();

        const username = $("username").value.trim();
        const password = $("password").value;

        if (username === "admin" && password === "admin123") {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({
                id: 0,
                username: "admin",
                isAdmin: true
            }));
            $("loginMessage").textContent = "Admin login successful! Redirecting...";
            $("loginMessage").style.color = "var(--green)";
            setTimeout(() => { window.location.href = "admin.html"; }, 800);
            return;
        }

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                $("loginMessage").textContent = data.error || "Invalid credentials.";
                $("loginMessage").style.color = "var(--red)";
                return;
            }

            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user));
            $("loginMessage").textContent = "Login successful! Redirecting...";
            $("loginMessage").style.color = "var(--green)";
            setTimeout(() => {
                window.location.href = data.user.isAdmin ? "admin.html" : "index.html";
            }, 800);
        } catch (err) {
            let users = JSON.parse(localStorage.getItem("studentUsers") || "[]");
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
                window.location.href = "index.html";
            } else {
                $("loginMessage").textContent = "Invalid username or password.";
                $("loginMessage").style.color = "var(--red)";
            }
        }
    });
}