import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sanitizeRedirectPath } from "@/lib/validations/auth";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: getUser() sends a request to the Supabase Auth server and validates the JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const isAuthPage =
    url.pathname.startsWith("/login") || url.pathname.startsWith("/register");
  const isPublicPage = isAuthPage || url.pathname.startsWith("/invite");

  // If user is unauthenticated and attempting to access an application route, redirect to /login
  if (!user && !isPublicPage) {
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // If user is authenticated and navigating to login/register, redirect to destination or /
  if (user && isAuthPage) {
    const redirectParam = sanitizeRedirectPath(
      request.nextUrl.searchParams.get("redirect")
    );
    if (redirectParam !== "/") {
      return NextResponse.redirect(new URL(redirectParam, request.url));
    }
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

