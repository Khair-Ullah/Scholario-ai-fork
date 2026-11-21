import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/onboarding",
  "/scholarships",
  "/saved",
  "/tracker",
  "/checklist",
  "/profile",
  "/templates",
  "/advisor",
  "/sop-reviewer",
  "/visa-travel",
  "/notifications",
  "/referral",
  "/billing",
];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const protectedRoute = protectedRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );
  const hasSession = request.cookies.has("access_token");

  const isAdminRoute = path === "/admin" || path.startsWith("/admin/");
  if (isAdminRoute && path !== "/admin/login" && !hasSession) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  const isConsultantRoute = path === "/consultant" || path.startsWith("/consultant/");
  if (isConsultantRoute && path !== "/consultant/login" && !hasSession) {
    const login = new URL("/consultant/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  if (protectedRoute && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};