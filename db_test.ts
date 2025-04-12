import postgres from "postgres";

const DB_HOST = Deno.env.get("DB_HOST") || "localhost";
const DB_PORT = parseInt(Deno.env.get("DB_PORT") ?? "5432");
const DB_USER = Deno.env.get("DB_USER");
const DB_PASSWORD = Deno.env.get("DB_PASSWORD");
const DB_NAME = Deno.env.get("DB_NAME");

const sql = postgres({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
});

async function testDbConnection() {
  console.log(
    `Attempting to connect to database ${DB_NAME} on ${DB_HOST}:${DB_PORT}...`,
  );

  try {
    const res = await sql`SELECT NOW();`;

    console.log("Database connection successful!");
    console.log("Current DB timestamp:", res);

    await sql`
      CREATE TABLE IF NOT EXISTS test_table (
        id SERIAL PRIMARY KEY,
        message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    console.log("Ensured 'test_table' exists.");

    const messageText = `Hello from Deno at ${new Date().toISOString()}`;
    await sql`
      INSERT INTO test_table (message) VALUES (${messageText});
    `;
    console.log("Inserted test message.");

    const messages = await sql`
      SELECT id, message FROM test_table ORDER BY created_at DESC LIMIT 5;
    `;
    console.log("Last 5 messages:", messages);
  } catch (error) {
    console.error("Database connection or query failed:", error);
  } finally {
    console.log("Closing database connection pool...");
    await sql.end({ timeout: 5 });
    console.log("Connection pool closed");
  }
}

await testDbConnection();
