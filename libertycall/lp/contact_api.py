import os
import sys
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from mailer import send_ses_email, get_pdf_path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

UNSUBSCRIBE_FILE = os.path.join(os.path.dirname(__file__), 'unsubscribed_emails.json')

def load_unsubscribed():
    if os.path.exists(UNSUBSCRIBE_FILE):
        with open(UNSUBSCRIBE_FILE, 'r') as f:
            return set(json.load(f))
    return set()

def save_unsubscribed(emails):
    with open(UNSUBSCRIBE_FILE, 'w') as f:
        json.dump(list(emails), f)

def is_unsubscribed(email):
    return email in load_unsubscribed()

@app.route("/api/contact", methods=["POST"])
def handle_contact_form():
    data = request.get_json()
    email = data.get('email', '').strip()
    name = data.get('name', '').strip()
    company = data.get('company', '').strip()
    message = data.get('message', '').strip()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    if is_unsubscribed(email):
        return jsonify({'error': 'This email is unsubscribed'}), 400

    pdf_path = get_pdf_path()
    pdf_base64 = None
    if pdf_path:
        import base64
        with open(pdf_path, 'rb') as f:
            pdf_base64 = base64.b64encode(f.read()).decode('utf-8')

    admin_body = f"Name: {name}\nEmail: {email}\nCompany: {company}\nMessage: {message}"
    try:
        send_ses_email(
            to_email=os.getenv('ADMIN_EMAIL', 'admin@libcall.com'),
            subject='New Contact Form Submission',
            body_html=admin_body.replace('\n', '<br>')
        )
    except Exception as e:
        logger.error(f"Admin email failed: {e}")

    reply_body = "<html><body>"
    reply_body += "<p>Dear " + name + ",</p>"
    reply_body += "<p>Thank you for your inquiry. We will get back to you shortly.</p>"
    reply_body += "<p>Best regards,<br>LibertyCall Team</p>"
    reply_body += "</body></html>"

    try:
        send_ses_email(
            to_email=email,
            subject='Thank you for contacting LibertyCall',
            body_html=reply_body
        )
    except Exception as e:
        logger.error(f"Reply email failed: {e}")
        return jsonify({'error': 'Failed to send reply'}), 500

    return jsonify({'message': 'Success', 'pdf': pdf_base64}), 200

@app.route("/api/unsubscribe", methods=["POST"])
def handle_unsubscribe():
    data = request.get_json()
    email = data.get('email', '').strip()
    if not email:
        return jsonify({'error': 'Email required'}), 400
    emails = load_unsubscribed()
    emails.add(email)
    save_unsubscribed(emails)
    return jsonify({'message': 'Unsubscribed'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
