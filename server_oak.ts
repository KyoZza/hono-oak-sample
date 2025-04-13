import { Application, HttpError, Router } from "@oak/oak";
// import { Data } from "./data.ts";
import {
  UserBodySchema,
  UserIdParam,
  UserIdParamSchema,
  UserPayload,
  UserQuery,
  UserQuerySchema,
} from "./schemas.ts";
import { validate, type ValidatedRequest } from "./validate.ts";
import postgres from "postgres";

interface ApplicationState {
  sql: postgres.Sql;
}

const DB_HOST = Deno.env.get("DB_HOST") || "localhost";
const DB_PORT = parseInt(Deno.env.get("DB_PORT") ?? "5432");
const DB_USER = Deno.env.get("DB_USER");
const DB_PASSWORD = Deno.env.get("DB_PASSWORD");
const DB_NAME = Deno.env.get("DB_NAME");

console.log(
  `Initializing connection to ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}`,
);

const sql = postgres({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  onnotice: (notice) => console.log("DB Notice:", notice.message),
});
console.log("Database client initialized.");

const app = new Application<ApplicationState>();
const router = new Router<ValidatedRequest>();

app.state.sql = sql;

// logger middleware
app.use(async (ctx, next) => {
  console.log(`[${ctx.request.method}] - ${ctx.request.url.pathname}`);

  const startTime = Date.now();
  await next();
  const ms = Date.now() - startTime;

  console.log(`=> Response status: ${ctx.response.status} (${ms}ms)`);
});

// error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.log({ error });

    if (error instanceof HttpError) {
      const { message, status, ...rest } = error;

      // Check if it's an HttpError thrown by ctx.throw
      if (status) {
        ctx.response.status = status;
        ctx.response.body = { error: message, ...rest };
      } else {
        // Generic internal server error
        console.error("Unhandled Error:", error);
        ctx.response.status = 500;
        ctx.response.body = { error: "Internal Server Error" };
      }
    } else if (error instanceof postgres.PostgresError) {
      const { code, message } = error;
      console.error("Database Error:", { code, message });

      ctx.response.status = 500;
      ctx.response.body = { error: "Database operation failed" };
    }
  }
});

// authentication middleware
app.use(async (ctx, next) => {
  const { pathname } = ctx.request.url;

  if (pathname.startsWith("/users")) {
    const apiKey = ctx.request.headers.get("X-API-key");
    const validApiKey = Deno.env.get("API_KEY") ?? "dummy-key";

    if (!apiKey || apiKey !== validApiKey) {
      console.warn("Authentication failed: Invalid or missing API key");
      ctx.throw(401, "Unauthorized");
    }
  }

  console.log("Authentication successful");

  await next();
});

router
  .get("/", (ctx) => {
    ctx.response.body =
      "Welcome! Try GET /users, POST /users, or DELETE /users/:id";
  })
  .get("/users", validate("query", UserQuerySchema), async (ctx) => {
    const { name } = ctx.state.validatedQuery as UserQuery;
    const { sql } = ctx.app.state as ApplicationState;

    // const users = Data.shared.users.filter((user) =>
    //   user.name.toLowerCase().includes(name.toLowerCase())
    // );

    const nameQuery = (name?: string) =>
      name ? sql`WHERE LOWER(name) like ${name.toLowerCase() + "%"}` : sql``;

    const res = await sql`
      SELECT id, name FROM app_users 
      ${nameQuery(name)}
      ORDER BY id;
    `;

    ctx.response.body = res;
  })
  .post("/users", validate("json", UserBodySchema), async (ctx) => {
    const payload = ctx.state.validatedJson as UserPayload;
    const { sql } = ctx.app.state as ApplicationState;

    // const user = Data.shared.createUser(payload.name);

    const res = await sql`
      INSERT INTO app_users (name) 
      VALUES (${payload.name})
      RETURNING id, name
    `;

    ctx.response.status = 201;
    ctx.response.body = res;
  })
  .get("/users/:id", validate("params", UserIdParamSchema), async (ctx) => {
    const { id } = ctx.state.validatedParams as UserIdParam;
    const { sql } = ctx.app.state as ApplicationState;

    // const user = Data.shared.deleteUser(id);
    const res = await sql`SELECT id, name FROM app_users WHERE id = ${id}`;

    if (!res.length) {
      ctx.throw(404, `User not found.`);
    }

    ctx.response.body = res[0];
  })
  .put(
    "/users/:id",
    validate("params", UserIdParamSchema),
    validate("json", UserBodySchema),
    async (ctx) => {
      const { id } = ctx.state.validatedParams as UserIdParam;
      const { name } = ctx.state.validatedJson as UserPayload;
      const { sql } = ctx.app.state as ApplicationState;

      const res = await sql`
          UPDATE app_users 
          SET name = ${name} 
          WHERE id = ${id}
          RETURNING id, name
        `;

      if (res.count === 0) {
        ctx.throw(404, `User not found.`);
      }

      ctx.response.body = res[0];
    },
  )
  .delete("/users/:id", validate("params", UserIdParamSchema), async (ctx) => {
    const { id } = ctx.state.validatedParams as UserIdParam;
    const { sql } = ctx.app.state as ApplicationState;

    // const user = Data.shared.deleteUser(id);

    const res =
      await sql`DELETE FROM app_users WHERE id = ${id} RETURNING id, name`;

    if (res.count === 0) {
      ctx.throw(404, `User not found`);
    }

    ctx.response.body = { message: "User deleted!", user: res[0] };
  });

app.use(router.routes());
app.use(router.allowedMethods());

async function shutdown() {
  console.log("\nShutting down server and closing database pool...");

  try {
    await app.state.sql.end({ timeout: 5 });

    console.log("Database pool closed.");
  } catch (error) {
    console.error("Error closing database pool:", error);
  }

  Deno.exit();
}

Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

app.listen({ port: 8080 });
