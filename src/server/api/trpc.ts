import { initTRPC, TRPCError } from "@trpc/server";
import { type FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { ZodError } from "zod";
import {
  NotFoundError,
  ValidationError,
  DatabaseConfigurationError,
} from "@/server/errors";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export interface CreateContextOptions {
  headers?: Headers;
  user?: User | null;
}

/**
 * Creates context for incoming tRPC requests.
 * Extracts the authenticated Supabase user session when running in a request context,
 * or accepts an explicitly provided user for test callers.
 */
export const createTRPCContext = async (
  opts?: FetchCreateContextFnOptions | CreateContextOptions
) => {
  // If user is explicitly provided (e.g. in test callers or mock contexts)
  if (opts && "user" in opts && opts.user !== undefined) {
    return {
      headers: "headers" in opts ? opts.headers : undefined,
      user: opts.user,
    };
  }

  let user: User | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    // In environments where cookies() or Supabase cannot be initialized (e.g. CLI or unit tests), user remains null
    user = null;
  }

  return {
    headers:
      opts && "req" in opts
        ? opts.req.headers
        : opts && "headers" in opts
        ? opts.headers
        : undefined,
    user,
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

/**
 * Authentication middleware.
 * Ensures the request originates from a verified authenticated session.
 * Rejects unauthenticated requests with HTTP 401 UNAUTHORIZED.
 */
const enforceUserIsAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.user.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to perform this action.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure.use(errorHandlingMiddleware);
export const protectedProcedure = t.procedure
  .use(errorHandlingMiddleware)
  .use(enforceUserIsAuthed);
