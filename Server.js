require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3001;


app.use(
  cors({
    origin: "https://frontdata.vercel.app", // Use you
    methods: ["GET", "POST", "DELETE", "OPTIONS"], // Added OPTIONS 
    credentials: true,
  })
);

app.use(express.json());

// ─────────────────────────────────────────────
//  PostgreSQL 
// ────────────────────────────────────────────
const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

// Test DB connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌  Could not connect to PostgreSQL:");
    console.error("    →", err.message);
    console.error("    Check your .env credentials and make sure pgAdmin/Postgres is running.");
    return;
  }
  release();
  console.log("✅  Connected to PostgreSQL successfully!");
});

// ─────────────────────────────────────────────
//  Auto-create table if it doesn't exist
// ─────────────────────────────────────────────
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(255)  NOT NULL,
        content     TEXT          NOT NULL,
        created_at  TIMESTAMP     DEFAULT NOW()
      );
    `);
    console.log("✅  Table 'notes' is ready.");
  } catch (err) {
    console.error("❌  Failed to create table:", err.message);
  }
};

initDB();

// ─────────────────────────────────────────────
//  Routes
// ─────────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", time: new Date().toISOString() });
});

// GET all notes
app.get("/api/notes", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM notes ORDER BY created_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("GET /api/notes error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create note
app.post("/api/notes", async (req, res) => {
  const { title, content } = req.body;

  if (!title || !content) {
    return res
      .status(400)
      .json({ success: false, error: "Both title and content are required." });
  }

  try {
    const result = await pool.query(
      "INSERT INTO notes (title, content) VALUES ($1, $2) RETURNING *",
      [title.trim(), content.trim()]
    );
    console.log("📝  Note saved:", result.rows[0]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("POST /api/notes error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE note by ID
app.delete("/api/notes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM notes WHERE id = $1 RETURNING id",
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Note not found." });
    }
    console.log("🗑️   Note deleted:", id);
    res.json({ success: true, message: `Note ${id} deleted.` });
  } catch (err) {
    console.error("DELETE /api/notes error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("");
  console.log(`🚀  Backend running  →  http://localhost:${PORT}`);
  console.log(`📋  API endpoints:`);
  console.log(`    GET    http://localhost:${PORT}/api/notes`);
  console.log(`    POST   http://localhost:${PORT}/api/notes`);
  console.log(`    DELETE http://localhost:${PORT}/api/notes/:id`);
  console.log(`    GET    http://localhost:${PORT}/api/health`);
  console.log("");
});
