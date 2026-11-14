import { initTRPC, TRPCError } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { ZodError } from "zod";
import { NotFoundError, ValidationError, DatabaseConfigurationError } from "@/server/errors";

/**
 * Creates context for incoming tRPC requests.
 * Can be extended in future phases for authentication sessions, headers, etc.
 */
export const createTRPCContext = async (opts?: FetchCreateContextFnOptions) => {
  return {
    headers: opts?.req.headers,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Centralized error-handling middleware.
 * Intercepts errors returned from downstream procedure resolvers and translates
 * domain-level application errors (NotFoundError, ValidationError, DatabaseConfigurationError)
 * into standardized TRPCError instances with appropriate status codes.
 */
const errorHandlingMiddleware = t.middleware(async ({ next }) => {
  const result = await next();

  if (!result.ok) {
    const error = result.error;
    const targetError = error.cause ? error.cause : error;

    if (targetError instanceof NotFoundError) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: targetError.message,
        cause: targetError,
      });
    }

    if (targetError instanceof ValidationError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: targetError.message,
        cause: targetError,
      });
    }

    if (targetError instanceof DatabaseConfigurationError) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: targetError.message,
        cause: targetError,
      });
    }
  }

  return result;
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure.use(errorHandlingMiddleware);
