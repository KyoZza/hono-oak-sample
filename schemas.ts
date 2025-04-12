import { z } from "zod";
import {
  type InferOutput,
  nonEmpty,
  object,
  optional,
  pipe,
  string,
  transform,
  trim,
} from "@valibot/valibot";

/** Schema for query parameters on GET /users */
export const UserQuerySchema = z.object({
  name: z.optional(z.string()),
});
// export const UserQuerySchema = object({
//   name: optional(string()),
// });

/**  Schema for route parameters on /users/:id routes */
export const UserIdParamSchema = z.object({
  id: z.coerce.number().nonnegative().pipe(z.int()),
});

/** Schema for the request body on POST /users */
export const CreateUserSchema = z.object({
  name: z.string("Name is required and must be a string.")
    .trim()
    .nonempty("Name cannot be empty."),
});

// z.string("Name is required and must be a string."),
// trim(),
// nonEmpty("Name cannot be empty."),

export type UserQuery = z.infer<typeof UserQuerySchema>;
// export type UserQuery = InferOutput<typeof UserQuerySchema>;
export type UserIdParam = z.infer<typeof UserIdParamSchema>;
// export type UserIdParam = InferOutput<typeof UserIdParamSchema>;
export type CreateUserPayload = z.infer<typeof CreateUserSchema>;
// export type CreateUserPayload = InferOutput<typeof CreateUserSchema>;
