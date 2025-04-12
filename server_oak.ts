import { Application, HttpError, Router } from "@oak/oak";
import { Data } from "./data.ts";
import {
  CreateUserPayload,
  CreateUserSchema,
  UserIdParam,
  UserIdParamSchema,
  UserQuery,
  UserQuerySchema,
} from "./schemas.ts";
import { validate, type ValidatedRequest } from "./validate.ts";

const app = new Application<ValidatedRequest>();
const router = new Router<ValidatedRequest>();

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
    const { message, status, ...rest } = error as HttpError;

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
  .get("/users", validate("query", UserQuerySchema), (ctx) => {
    const { name } = ctx.state.validatedQuery as UserQuery;

    if (name) {
      const users = Data.shared.users.filter((user) =>
        user.name.toLowerCase().includes(name.toLowerCase())
      );

      ctx.response.body = users;
      return;
    }

    ctx.response.body = Data.shared.users;
    ctx.response.type = "json"; //  Explicitly set type, though often inferred
  })
  .post("/users", validate("json", CreateUserSchema), (ctx) => {
    const payload = ctx.state.validatedJson as CreateUserPayload;

    const user = Data.shared.createUser(payload.name);

    ctx.response.status = 201;
    ctx.response.body = user;
  })
  .get("/users/:id", validate("params", UserIdParamSchema), (ctx) => {
    const { id } = ctx.state.validatedParams as UserIdParam;

    const user = Data.shared.deleteUser(id);

    if (!user) {
      ctx.throw(404, `User not found.`);
    }

    ctx.response.body = user;
  })
  .delete("/users/:id", validate("params", UserIdParamSchema), (ctx) => {
    const { id } = ctx.state.validatedParams as UserIdParam;

    const user = Data.shared.deleteUser(id);

    if (!user) {
      ctx.throw(404, `User with ID ${id} doesn't exit.`);
    }

    ctx.response.body = { message: "User deleted!", user };
  });

app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 8080 });
