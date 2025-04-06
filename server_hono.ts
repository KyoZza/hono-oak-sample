import { Hono } from "@hono/hono";
import { User } from "./user.ts";
import { Data } from "./data.ts";

const app = new Hono();

app.use("*", async (c, next) => {
  console.log(`[${c.req.method}] - ${c.req.url}`);

  const startTime = Date.now();
  await next();
  const ms = Date.now() - startTime;

  console.log(`=> Response status: ${c.res.status} (${ms}ms)`);
});

// authentication middlewar
app.use("/users/*", async (c, next) => {
  const apiKey = c.req.header("X-API-Key");
  const validApiKey = Deno.env.get("API_KEY") ?? "dummy-key";

  if (!apiKey || apiKey !== validApiKey) {
    console.warn("Authentication failed: Invalid or missing API key");
    return c.json({ error: "Unauthorized" }, 401);
  }

  console.log("Authentication successful");

  await next();
});

app.get("/", (c) => {
  return c.text("Welcome! Try GET /users, POST /users, or DELETE /users/:id");
});

app.get("/users", (c) => {
  const nameFilter = c.req.query("name");

  if (nameFilter) {
    const users = Data.shared.users.filter(({ name }) =>
      name.toLowerCase().includes(nameFilter.toLowerCase())
    );

    return c.json(users);
  }

  return c.json(Data.shared.users);
});

app.post("/users", async (c) => {
  try {
    const contentType = c.req.header("Content-Type");

    if (!contentType?.includes("application/json")) {
      return c.json({ error: "Request body must be JSON" }, 415);
    }

    const body = await c.req.json<Partial<User>>();

    if (typeof body.name !== "string" || body.name.trim() === "") {
      return c.json({
        error:
          "Invalid user data: 'name' is required and must be a non-empty string.",
      }, 400);
    }

    const user = Data.shared.createUser(body.name);

    console.log("Added user:", user);

    return c.json(user, 201);
  } catch (error) {
    console.error("Error processing POST request:", error);

    return c.json({ error: "Failed to process request." }, 500);
  }
});

app.get("/users/:id", (c) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.json({ error: "Invalid user ID format." }, 400);
  }

  const user = Data.shared.getUser(id);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
});

app.delete("/users/:id", (c) => {
  const id = parseInt(c.req.param("id"));

  if (isNaN(id)) {
    return c.json({ error: "Invalid user ID format." }, 400);
  }

  const user = Data.shared.deleteUser(id);

  if (!user) {
    return c.json({
      error: `User with ID ${id} doesn't exit.`,
    }, 404);
  }

  return c.json({ message: "User deleted!", user }, 200);
});

Deno.serve({ port: 8080 }, app.fetch);
