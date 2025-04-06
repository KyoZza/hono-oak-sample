import { Application, HttpError, Router } from "@oak/oak";
import { Data } from "./data.ts";
import { User } from "./user.ts";

const app = new Application();
const router = new Router();

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
    const { message, status } = error as HttpError;

    // Check if it's an HttpError thrown by ctx.throw
    if (status) {
      ctx.response.status = status;
      ctx.response.body = { error: message };
    } else {
      // Generic internal server error
      console.error("Unhandled Error:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Internal Server Error" };
    }
  }
});

router
  .get("/", (ctx) => {
    ctx.response.body =
      "Welcome! Try GET /users, POST /users, or DELETE /users/:id";
  })
  .get("/users", (ctx) => {
    ctx.response.body = Data.shared.users;
    ctx.response.type = "json"; //  Explicitly set type, though often inferred
  })
  .post("/users", async (ctx) => {
    if (!ctx.request.hasBody) {
      ctx.throw(415, "Request body is required.");
    }

    const { body } = ctx.request;

    if (body.type() !== "json") {
      ctx.throw(415, "Request body must be JSON");
    }

    const payload: Partial<User> = await body.json();

    if (typeof payload.name !== "string" || payload.name.trim() === "") {
      ctx.throw(
        400,
        "Invalid user data: 'name' is required and must be a non-empty string.",
      );
    }

    const user = Data.shared.createUser(payload.name!);

    ctx.response.status = 201;
    ctx.response.body = user;
  })
  .delete("/users/:id", (ctx) => {
    const id = parseInt(ctx.params.id);

    if (isNaN(id)) {
      ctx.throw(400, "Invalid ID: number expected.");
    }

    const user = Data.shared.deleteUser(id);

    if (!user) {
      ctx.throw(404, `User with ID ${id} doesn't exit.`);
    }

    ctx.response.body = { message: "User deleted!", user };
  });

app.use(router.routes());
app.use(router.allowedMethods());

app.listen({ port: 8080 });
