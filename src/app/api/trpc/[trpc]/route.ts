import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { type NextRequest } from "next/server";

/**
 * Next.js App Router API endpoint for handling tRPC requests.
 */
const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: (opts) => createTRPCContext(opts),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC handler error on path '${path ?? "<no-path>"}': ${error.message}`
            );
          }
        : undefined,
  });

export { handler as GET, handler as POST };
