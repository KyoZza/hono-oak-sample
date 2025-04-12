import { type Next, RouteParams, type RouterContext, Status } from "@oak/oak";
import { z } from "zod";

// import {
//   type BaseSchema,
//   flatten,
//   type InferOutput,
//   safeParse,
// } from "@valibot/valibot";

export type ValidationTarget = "json" | "params" | "query";

export type ValidatedRequest = {
  [Target in ValidationTarget as `validated${Capitalize<Target>}`]?: z.infer<
    z.ZodType
  >;
};

/** Validation middleware. Supports validation for different `targets` */
export function validate<
  C extends RouterContext<string, RouteParams<string>, ValidatedRequest>,
  S extends z.ZodType,
>(
  target: ValidationTarget,
  schema: S,
) {
  return async (ctx: C, next: Next) => {
    let input: unknown;

    switch (target) {
      case "json": {
        if (!ctx.request.hasBody) {
          ctx.throw(Status.UnsupportedMediaType, "Request body is required.");
        }

        const { body } = ctx.request;

        if (body.type() !== "json") {
          ctx.throw(Status.UnsupportedMediaType, "Request body must be JSON");
        }

        input = await body.json();
        break;
      }
      case "params":
        input = ctx.params;
        break;
      case "query":
        input = Object.fromEntries(ctx.request.url.searchParams.entries());
        break;
      default:
        console.error("Invalid validation target:", target);
        ctx.throw(
          Status.InternalServerError,
          "Internal server configuration error",
        );
    }

    const result = z.safeParse(schema, input);
    const capitalizedTarget = target[0].toUpperCase() + target.slice(1);

    if (!result.success) {
      const error = z.treeifyError(result.error);
      console.warn(`Validation Error (${target}):`, error);

      ctx.throw(Status.BadRequest, `${capitalizedTarget} Validation Failed`, {
        details: error,
      });
    }

    const key = `validated${capitalizedTarget}` as keyof ValidatedRequest;

    // Attach validated data to ctx.state
    ctx.state[key] = result.data;

    await next();
  };
}
