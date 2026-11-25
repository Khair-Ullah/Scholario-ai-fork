from unittest.mock import patch

from app.services import email


def test_send_password_reset_without_smtp(monkeypatch) -> None:
    monkeypatch.delenv("SMTP_HOST", raising=False)
    assert email.send_password_reset("student@example.com", "https://example.com/reset?token=abc") is False


def test_send_verification_uses_ssl_when_configured(monkeypatch) -> None:
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_SSL", "true")
    monkeypatch.delenv("SMTP_USER", raising=False)

    with patch.object(email.smtplib, "SMTP_SSL") as smtp_class:
        assert email.send_verification("student@example.com", "https://example.com/verify") is True

    smtp_class.assert_called_once_with("smtp.example.com", 587, timeout=15)
    smtp_class.return_value.__enter__.return_value.login.assert_not_called()


def test_send_contact_message_uses_tls_and_reply_to(monkeypatch) -> None:
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_PORT", "2525")
    monkeypatch.setenv("SMTP_USER", "mailer")
    monkeypatch.setenv("SMTP_PASSWORD", "secret")
    monkeypatch.setenv("SMTP_SSL", "false")

    with patch.object(email.smtplib, "SMTP") as smtp_class:
        assert email.send_contact_message("Aisha", "aisha@example.com", "Billing", "Help please") is True

    smtp = smtp_class.return_value.__enter__.return_value
    smtp.starttls.assert_called_once_with()
    smtp.login.assert_called_once_with("mailer", "secret")
    message = smtp.send_message.call_args.args[0]
    assert message["Reply-To"] == "aisha@example.com"
    assert "Help please" in message.get_content()


def test_smtp_failure_does_not_break_caller(monkeypatch) -> None:
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_SSL", "false")

    with patch.object(email.smtplib, "SMTP") as smtp_class:
        smtp_class.return_value.__enter__.side_effect = OSError("offline")
        assert email.send_password_reset("student@example.com", "https://example.com/reset") is False


def test_send_verification_otp_uses_resend(monkeypatch) -> None:
    monkeypatch.setenv("EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("SMTP_FROM", "Scholario <no-reply@example.com>")

    with patch.object(email.httpx, "post") as post:
        post.return_value.status_code = 200
        assert email.send_verification_otp("student@example.com", "123456") is True

    post.assert_called_once()
    assert post.call_args.args[0] == email.RESEND_ENDPOINT
    assert post.call_args.kwargs["headers"]["Authorization"] == "Bearer re_test_key"
    assert post.call_args.kwargs["json"]["to"] == ["student@example.com"]
    assert "123456" in post.call_args.kwargs["json"]["text"]


def test_resend_failure_does_not_break_caller(monkeypatch) -> None:
    monkeypatch.setenv("EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")

    with patch.object(email.httpx, "post") as post:
        post.return_value.status_code = 401
        post.return_value.text = "unauthorized"
        assert email.send_password_reset("student@example.com", "https://example.com/reset") is False
