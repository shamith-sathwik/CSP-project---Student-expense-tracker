from flask import Flask, request, jsonify, send_from_directory
import sqlite3

app = Flask(__name__, static_folder=".")
DB_FILE = "tracker.db"

def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT NOT NULL,
                password TEXT NOT NULL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                category TEXT NOT NULL,
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                note TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS budgets (
                user_id INTEGER NOT NULL,
                month TEXT NOT NULL,
                amount REAL NOT NULL,
                PRIMARY KEY (user_id, month),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        conn.commit()

@app.route("/")
def root():
    return send_from_directory(".", "login.html")

@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    if data["username"].strip().lower() == "admin":
        return jsonify({"error": "Username 'admin' is reserved."}), 400
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute(
                "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
                (data["username"], data["email"], data["password"])
            )
            conn.commit()
        return jsonify({"message": "Registered"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists."}), 400

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    if data["username"] == "admin" and data["password"] == "admin123":
        return jsonify({
            "user": {"id": 0, "username": "admin", "email": "admin@tracker.local", "isAdmin": True}
        }), 200

    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            "SELECT id, username, email FROM users WHERE username = ? AND password = ?",
            (data["username"], data["password"])
        )
        row = c.fetchone()
        if row:
            return jsonify({"user": {"id": row[0], "username": row[1], "email": row[2], "isAdmin": False}}), 200
        return jsonify({"error": "Invalid username or password."}), 401

@app.route("/api/admin/users", methods=["GET"])
def get_all_users():
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("""
            SELECT u.id, u.username, u.email, u.password, COUNT(e.id) as expense_count
            FROM users u
            LEFT JOIN expenses e ON u.id = e.user_id
            GROUP BY u.id
            ORDER BY u.id DESC
        """)
        users = [
            {
                "id": r[0],
                "username": r[1],
                "email": r[2],
                "password": r[3],
                "expense_count": r[4]
            }
            for r in c.fetchall()
        ]
    return jsonify({"users": users}), 200

@app.route("/api/data", methods=["GET"])
def get_data():
    user_id = request.args.get("user_id")
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("SELECT id, category, amount, date, note FROM expenses WHERE user_id = ?", (user_id,))
        expenses = [
            {"id": r[0], "category": r[1], "amount": r[2], "date": r[3], "note": r[4]}
            for r in c.fetchall()
        ]
        c.execute("SELECT month, amount FROM budgets WHERE user_id = ?", (user_id,))
        budgets = {r[0]: r[1] for r in c.fetchall()}
    return jsonify({"expenses": expenses, "budgets": budgets})

@app.route("/api/expenses", methods=["POST"])
def add_expense():
    data = request.json
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            "INSERT INTO expenses (user_id, category, amount, date, note) VALUES (?, ?, ?, ?, ?)",
            (data["user_id"], data["category"], data["amount"], data["date"], data.get("note", ""))
        )
        conn.commit()
        new_id = c.lastrowid
    return jsonify({
        "id": new_id,
        "category": data["category"],
        "amount": data["amount"],
        "date": data["date"],
        "note": data.get("note", "")
    }), 201

@app.route("/api/expenses/<int:expense_id>", methods=["DELETE"])
def delete_expense(expense_id):
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
        conn.commit()
    return jsonify({"message": "Deleted"}), 200

@app.route("/api/budgets", methods=["POST"])
def set_budget():
    data = request.json
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute(
            "INSERT OR REPLACE INTO budgets (user_id, month, amount) VALUES (?, ?, ?)",
            (data["user_id"], data["month"], data["amount"])
        )
        conn.commit()
    return jsonify({"message": "Budget saved"}), 200

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)