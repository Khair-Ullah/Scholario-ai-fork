import { ApiError, apiFetch } from "@/lib/api";

export type OtpErrorCode =
  | "INTEGRATION_PENDING"
  | "INVALID_EMAIL"
  | "INVALID_OTP"
  | "OTP_EXPIRED"
  | "OTP_LIMIT"
  | "RATE_LIMITED"
  | "NETWORK";

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
  verify: "/api/auth/verify-email",
  resend: "/api/auth/resend-otp",
} as const;

const OTP_ERROR_CODES: OtpErrorCode[] = [
  "INTEGRATION_PENDING",
  "INVALID_EMAIL",
  "INVALID_OTP",
  "OTP_EXPIRED",
  "OTP_LIMIT",
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
  if (upper === "OTP_INVALID") return "INVALID_OTP";
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

function mockVerify(otp: string): void {
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
  if (!/^\d{6}$/.test(otp)) {
    throw new OtpServiceError("Enter the 6-digit code from your email.", "INVALID_OTP");
  }
}

export async function verifyEmailOtp(email: string, otp: string): Promise<void> {
  if (OTP_MODE === "pending") throw pendingError();
  if (OTP_MODE === "mock") {
    await sleep(350);
    mockVerify(otp);
    return;
  }
  try {
    await apiFetch(OTP_ENDPOINTS.verify, {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
  } catch (error) {
    throw toOtpError(error, "We could not verify that code.", "INVALID_OTP");
  }
}

export async function resendEmailOtp(email: string): Promise<void> {
  if (OTP_MODE === "pending") throw pendingError();
  if (OTP_MODE === "mock") {
    await sleep(350);
    return;
  }
  try {
    await apiFetch(OTP_ENDPOINTS.resend, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    throw toOtpError(error, "We could not resend the verification code.", "RATE_LIMITED");
  }
}
