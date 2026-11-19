import logging
import os
import smtplib
from email.message import EmailMessage

logger = logging.getLogger("scholario.email")

FROM_ADDRESS = os.getenv("SMTP_FROM", "Scholario <no-reply@scholario.ai>")


def _smtp_configured() -> bool:
    return bool(os.getenv("SMTP_HOST"))


def _send(to: str, subject: str, body: str, reply_to: str | None = None) -> bool:
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
