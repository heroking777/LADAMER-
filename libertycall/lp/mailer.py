import os
import boto3
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

def send_ses_email(to_email, subject, body_html, from_email="noreply@libcall.com"):
    client = boto3.client('ses', region_name=os.environ.get('AWS_DEFAULT_REGION', 'ap-northeast-3'))
    response = client.send_email(
        Source=from_email,
        Destination={'ToAddresses': [to_email]},
        Message={
            'Subject': {'Data': subject, 'Charset': 'UTF-8'},
            'Body': {'Html': {'Data': body_html, 'Charset': 'UTF-8'}}
        }
    )
    return response

def get_pdf_path():
    pdf_path = os.getenv("MATERIAL_PDF_PATH", None)
    if pdf_path and os.path.exists(pdf_path):
        return pdf_path
    default_paths = [
        os.path.join(os.path.dirname(__file__), "サービス概要.pdf"),
        os.path.join(os.path.dirname(__file__), "LibertyCall_資料.pdf"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "lp", "サービス概要.pdf"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "lp", "LibertyCall_資料.pdf"),
    ]
    for path in default_paths:
        if os.path.exists(path):
            return path
    return None
