import logging
import fitz
import docx
import pandas as pd
from pptx import Presentation

logger = logging.getLogger(__name__)


def extract_txt(filepath):
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception as e:
        logger.warning(f"TXT read failed: {filepath}: {e}")
        return ""


def extract_pdf(filepath):
    text = ""
    try:
        doc = fitz.open(filepath)
        for page in doc:
            text += page.get_text()
        doc.close()
    except Exception as e:
        logger.warning(f"PDF extraction failed: {filepath}: {e}")
    return text


def extract_docx(filepath):
    try:
        doc = docx.Document(filepath)
        return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
    except Exception as e:
        logger.warning(f"DOCX extraction failed: {filepath}: {e}")
        return ""


def extract_doc_legacy(filepath):
    """Fallback for old .doc files - read as plain text."""
    try:
        with open(filepath, "rb") as f:
            raw = f.read()
        # Extract printable ASCII chunks (Word binary format contains readable text)
        import re
        text = re.findall(rb"[\x20-\x7e]{4,}", raw)
        return " ".join(t.decode("ascii", errors="ignore") for t in text)
    except Exception as e:
        logger.warning(f"DOC legacy extraction failed: {filepath}: {e}")
        return ""


def extract_pptx(filepath):
    try:
        prs = Presentation(filepath)
        text = ""
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    text += shape.text + "\n"
        return text
    except Exception as e:
        logger.warning(f"PPTX extraction failed: {filepath}: {e}")
        return ""


def extract_ppt_legacy(filepath):
    """Fallback for old .ppt files - extract printable text."""
    try:
        with open(filepath, "rb") as f:
            raw = f.read()
        import re
        text = re.findall(rb"[\x20-\x7e]{4,}", raw)
        return " ".join(t.decode("ascii", errors="ignore") for t in text)
    except Exception as e:
        logger.warning(f"PPT legacy extraction failed: {filepath}: {e}")
        return ""


def extract_spreadsheet(filepath):
    try:
        if filepath.lower().endswith(".csv"):
            df = pd.read_csv(filepath, nrows=200)
        else:
            df = pd.read_excel(filepath, nrows=200)
        return df.to_string()
    except Exception as e:
        logger.warning(f"Spreadsheet extraction failed: {filepath}: {e}")
        return ""


def extract_rtf(filepath):
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            raw = f.read()
        import re
        # Strip RTF control sequences
        text = re.sub(r"\{[^{}]*\}", "", raw)
        text = re.sub(r"\\[a-zA-Z]+\d* ?", "", text)
        text = re.sub(r"[{}\\]", "", text)
        return text.strip()
    except Exception as e:
        logger.warning(f"RTF extraction failed: {filepath}: {e}")
        return ""


def extract_text(filepath):
    ext = filepath.lower()
    if ext.endswith((".txt", ".md")):
        return extract_txt(filepath)
    elif ext.endswith(".pdf"):
        return extract_pdf(filepath)
    elif ext.endswith(".docx"):
        return extract_docx(filepath)
    elif ext.endswith(".doc"):
        return extract_doc_legacy(filepath)
    elif ext.endswith(".pptx"):
        return extract_pptx(filepath)
    elif ext.endswith(".ppt"):
        return extract_ppt_legacy(filepath)
    elif ext.endswith((".xlsx", ".xls", ".csv")):
        return extract_spreadsheet(filepath)
    elif ext.endswith(".rtf"):
        return extract_rtf(filepath)
    return None