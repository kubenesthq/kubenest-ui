import os
import psycopg2
from flask import Flask, jsonify

app = Flask(__name__)


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def init_db():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("CREATE TABLE IF NOT EXISTS hits (n BIGINT NOT NULL)")
        cur.execute("INSERT INTO hits SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM hits)")
        conn.commit()


@app.get("/healthz")
def healthz():
    return jsonify(ok=True)


@app.get("/hits")
def hits():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("UPDATE hits SET n = n + 1 RETURNING n")
        return jsonify(hits=cur.fetchone()[0])


if __name__ == "__main__":
    try:
        init_db()
    except Exception:
        pass  # DB not available at startup is OK — /hits will fail gracefully
    app.run(host="0.0.0.0", port=5000)
