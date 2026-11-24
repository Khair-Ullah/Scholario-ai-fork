import { ApiError, apiFetch, resetSessionCache } from "@/lib/api";

export type OtpPurpose = "registration" | "password-reset";

export type OtpErrorCode =
  | "INTEGRATION_PENDING"
  | "INVALID_EMAIL"
  | "INVALID_OTP"
  | "OTP_EXPIRED"
  | "RATE_LIMITED"
  | "NETWORK";

export type OtpVerificationResult =
  | { status: "verified" }
  | { status: "reset_token"; resetToken: string };

export class OtpServiceError extends Error {
  code: OtpErrorCode;

  constructor(message: string, code: OtpErrorCode) {
    super(message);
    this.name = "OtpServiceError";
    this.code = code;
  }
}

type OtpMode = "pending" | "backend" | "mock";

function resolveOtpMode(): OtpMode {
  const raw = (process.env.NEXT_PUBLIC_AUTH_OTP_MODE ?? "pending").trim().toLowerCase();
  if (raw === "backend") return "backend";
  if (raw === "mock" && process.env.NODE_ENV !== "production") return "mock";
  return "pending";
}

export const OTP_MODE = resolveOtpMode();

const OTP_ENDPOINTS = {
  request: "/api/auth/otp/request",
  verify: "/api/auth/otp/verify",
  resend: "/api/auth/otp/resend",
} as const;

const OTP_ERROR_CODES: OtpErrorCode[] = [
  "INTEGRATION_PENDING",
  "INVALID_EMAIL",
  "INVALID_OTP",
  "OTP_EXPIRED",
  "RATE_LIMITED",
  "NETWORK",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pendingError(): OtpServiceError {
  return new OtpServiceError(
    "Email verification is not available yet. Please contact support.",
    "INTEGRATION_PENDING",
  );
}

function normalizeCode(code?: string): OtpErrorCode | undefined {
  if (!code) return undefined;
  const upper = code.toUpperCase();
  return OTP_ERROR_CODES.find((item) => item === upper);
}

function toOtpError(error: unknown, fallback: string, fallbackCode: OtpErrorCode): OtpServiceError {
  if (error instanceof OtpServiceError) return error;
  if (error instanceof ApiError) {
    const code =
      normalizeCode(error.code) ??
      (error.status === 429
        ? "RATE_LIMITED"
        : error.status === 410
          ? "OTP_EXPIRED"
          : fallbackCode);
    return new OtpServiceError(error.message || fallback, code);
  }
  return new OtpServiceError(fallback, "NETWORK");
}

function mockVerify(purpose: OtpPurpose, email: string, code: string): OtpVerificationResult {
  const simulate =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("simulate") ?? "";

  if (simulate === "invalid") {
    throw new OtpServiceError("That code is not correct. Please try again.", "INVALID_OTP");
  }
  if (simulate === "expired") {
    throw new OtpServiceError("That code has expired. Request a new one.", "OTP_EXPIRED");
  }
  if (simulate === "rate-limited") {
    throw new OtpServiceError("Too many attempts. Please wait before trying again.", "RATE_LIMITED");
  }
  if (!/^\d{6}$/.test(code)) {
    throw new OtpServiceError("Enter the 6-digit code from your email.", "INVALID_OTP");
  }

  if (purpose === "password-reset") {
    return { status: "reset_token", resetToken: `dev-mock-reset-token-${email}` };
  }
  return { status: "verified" };
}

export async function requestOtp(purpose: OtpPurpose, email: string): Promise<void> {
  if (OTP_MODE === "pending") throw pendingError();
  if (OTP_MODE === "mock") {
    await sleep(350);
    return;
  }
  try {
    await apiFetch(OTP_ENDPOINTS.request, {
      method: "POST",
      body: JSON.stringify({ purpose, email }),
    });
  } catch (error) {
    throw toOtpError(error, "We could not send the verification code.", "INVALID_EMAIL");
  }
}

export async function resendOtp(purpose: OtpPurpose, email: string): Promise<void> {
  if (OTP_MODE === "pending") throw pendingError();
  if (OTP_MODE === "mock") {
    await sleep(350);
    return;
  }
  try {
    await apiFetch(OTP_ENDPOINTS.resend, {
      method: "POST",
      body: JSON.stringify({ purpose, email }),
    });
  } catch (error) {
    throw toOtpError(error, "We could not resend the verification code.", "RATE_LIMITED");
  }
}

export async function verifyOtp(
  purpose: OtpPurpose,
  email: string,
  code: string,
): Promise<OtpVerificationResult> {
  if (OTP_MODE === "pending") throw pendingError();
  if (OTP_MODE === "mock") return mockVerify(purpose, email, code);
  try {
    const response = await apiFetch<{ reset_token?: string }>(OTP_ENDPOINTS.verify, {
      method: "POST",
      body: JSON.stringify({ purpose, email, code }),
    });
    if (purpose === "password-reset") {
      if (!response.reset_token) {
        throw new OtpServiceError("The verification response was incomplete.", "NETWORK");
      }
      return { status: "reset_token", resetToken: response.reset_token };
    }
    return { status: "verified" };
  } catch (error) {
    throw toOtpError(error, "We could not verify that code.", "INVALID_OTP");
  }
}

export async function clearRegistrationSession(): Promise<void> {
  resetSessionCache();
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    resetSessionCache();
  }
}
