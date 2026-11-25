import logging
import os
import smtplib
from email.message import EmailMessage

import httpx

logger = logging.getLogger("scholario.email")

FROM_ADDRESS = os.getenv("SMTP_FROM", "Scholario <no-reply@scholario.ai>")
RESEND_ENDPOINT = "https://api.resend.com/emails"


def _resend_configured() -> bool:
    return bool(os.getenv("RESEND_API_KEY", "").strip())


def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def _send_via_resend(to: str, subject: str, body: str, reply_to: str | None = None) -> bool:
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        logger.warning("Resend selected but RESEND_API_KEY is missing")
        return False
    payload = {"from": FROM_ADDRESS, "to": [to], "subject": subject, "text": body}
    if reply_to:
        payload["reply_to"] = reply_to
    try:
        response = httpx.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
            timeout=15,
        )
        if response.status_code >= 400:
            logger.error(
                "Resend rejected email to %s: %s %s",
                to,
                response.status_code,
                response.text[:300],
            )
            return False
        return True
    except Exception:
        logger.exception("Failed to send email to %s via Resend", to)
        return False


def _send(to: str, subject: str, body: str, reply_to: str | None = None) -> bool:
    provider = os.getenv("EMAIL_PROVIDER", "auto").strip().lower()
    if provider == "resend" or (provider == "auto" and _resend_configured()):
        return _send_via_resend(to, subject, body, reply_to)
    if provider not in {"auto", "smtp"}:
        logger.warning("Unknown EMAIL_PROVIDER=%s; falling back to SMTP", provider)
    if not _smtp_configured():
        if os.getenv("APP_ENV", "development") == "production":
            logger.warning("Email not sent to %s: SMTP is not configured", to)
        else:
            logger.info("[email stub] To: %s | Subject: %s\n%s", to, subject, body)
        return False

    message = EmailMessage()
    message["From"] = FROM_ADDRESS
    message["To"] = to
    message["Subject"] = subject
    if reply_to:
        message["Reply-To"] = reply_to
    message.set_content(body)

    host = os.getenv("SMTP_HOST", "")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    password = os.getenv("SMTP_PASSWORD", "")
    use_ssl = os.getenv("SMTP_SSL", "false").lower() == "true"

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=15) as smtp:
                if user:
                    smtp.login(user, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=15) as smtp:
                smtp.starttls()
                if user:
                    smtp.login(user, password)
                smtp.send_message(message)
        return True
    except Exception:  # noqa: BLE001 - never let email delivery break a request
        logger.exception("Failed to send email to %s", to)
        return False


def send_password_reset(to: str, link: str) -> bool:
    body = (
        "We received a request to reset your Scholario password.\n\n"
        f"Reset it here (valid for 30 minutes): {link}\n\n"
        "If you did not request this, you can ignore this email. Your password will not change.\n"
    )
    return _send(to, "Reset your Scholario password", body)


def send_verification(to: str, link: str) -> bool:
    body = (
        "Welcome to Scholario.\n\n"
        f"Confirm your email address to finish setting up your account: {link}\n\n"
        "If you did not create this account, you can ignore this email.\n"
    )
    return _send(to, "Confirm your Scholario email", body)


def send_verification_otp(to: str, otp: str) -> bool:
    body = (
        "Welcome to Scholario!\n\n"
        "Your email verification code is:\n\n"
        f"{otp}\n\n"
        "This code expires in 10 minutes.\n"
        "Do not share this code with anyone.\n\n"
        "If you did not create this account, you can ignore this email.\n"
    )
    return _send(to, "Verify your Scholario account", body)


def send_contact_message(name: str, email: str, topic: str, message: str) -> bool:
    inbox = os.getenv("CONTACT_INBOX", "support@scholario.ai")
    body = (
        "New message from the Scholario contact form.\n\n"
        f"Name: {name}\n"
        f"Email: {email}\n"
        f"Topic: {topic}\n\n"
        f"{message}\n"
    )
    return _send(inbox, f"[Contact] {topic} — {name}", body, reply_to=email)
