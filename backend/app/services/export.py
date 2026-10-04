from io import BytesIO

import bleach
from docx import Document as WordDocument
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def content_text(content_html: str) -> str:
    return bleach.clean(content_html, tags=[], strip=True).replace("&nbsp;", " ").strip()


def export_document(content_html: str, title: str, format_name: str) -> tuple[bytes, str, str]:
    text = content_text(content_html)
    if format_name == "txt":
        return text.encode("utf-8"), "text/plain; charset=utf-8", f"{title}.txt"
    if format_name == "docx":
        document = WordDocument()
        for paragraph in text.splitlines():
            document.add_paragraph(paragraph)
        output = BytesIO()
        document.save(output)
        return (
            output.getvalue(),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            f"{title}.docx",
        )
    if format_name == "pdf":
        output = BytesIO()
        page = canvas.Canvas(output, pagesize=letter)
        width, height = letter
        y = height - 54
        page.setTitle(title)
        for line in text.splitlines() or [""]:
            if y < 54:
                page.showPage()
                y = height - 54
            page.drawString(54, y, line[:120])
            y -= 16
        page.save()
        return output.getvalue(), "application/pdf", f"{title}.pdf"
    raise ValueError("format must be docx, pdf, or txt")
