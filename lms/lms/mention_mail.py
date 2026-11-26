"""Reply to a question mention by email.

Outgoing: a mention email carries a Reply-To address ``<mailbox>+<token>@<domain>``.
Incoming: a received email addressed to such a token is saved as a Discussion Reply on
the question it belongs to, posted as the person who sent it.

The token is ``<topic>.<signature>``. The signature is an HMAC of the topic and the
recipient, so only the person who was mentioned can post through it.
"""

import hashlib
import hmac
import re

import frappe
from frappe.utils import cint, parse_addr
from frappe.utils.password import get_encryption_key

TOKEN_RE = re.compile(r"\+([A-Za-z0-9_-]+)\.([0-9a-f]{20})@", re.IGNORECASE)
MAX_REPLIES_PER_HOUR = 30
AUTO_REPLY_SUBJECTS = ("out of office", "automatic reply", "auto-reply", "autoreply", "undeliverable")


def make_signature(topic: str, user: str) -> str:
	key = get_encryption_key().encode()
	message = f"{topic}|{user.lower()}".encode()
	return hmac.new(key, message, hashlib.sha256).hexdigest()[:20]


def get_inbound_account() -> dict | None:
	"""The email account that receives replies (incoming enabled)."""
	account = frappe.db.get_value(
		"Email Account",
		{"enable_incoming": 1, "enable_outgoing": 1, "default_outgoing": 1},
		["email_id"],
		as_dict=True,
	) or frappe.db.get_value("Email Account", {"enable_incoming": 1}, ["email_id"], as_dict=True)
	return account


def get_reply_to_address(topic: str, user: str) -> str | None:
	"""`mailbox+token@domain` for this topic and recipient, or None if replies can't be received."""
	account = get_inbound_account()
	if not account or not account.email_id or "@" not in account.email_id:
		return None
	local, domain = account.email_id.split("@", 1)
	return f"{local}+{topic}.{make_signature(topic, user)}@{domain}"


def parse_token(addresses: str | None) -> tuple[str, str] | None:
	if not addresses:
		return None
	match = TOKEN_RE.search(addresses)
	if not match:
		return None
	return match.group(1), match.group(2).lower()


def extract_reply_text(content: str) -> str:
	"""The new part of an email, without quoted history or signatures."""
	from bs4 import BeautifulSoup
	from email_reply_parser import EmailReplyParser

	if "<" in content and ">" in content:
		soup = BeautifulSoup(content, "html.parser")
		for node in soup.select("blockquote, .gmail_quote, .gmail_attr, .yahoo_quoted, #divRplyFwdMsg"):
			node.decompose()
		for br in soup.find_all("br"):
			br.replace_with("\n")
		for block in soup.find_all(["p", "div"]):
			block.append("\n")
		text = soup.get_text()
	else:
		text = content

	return EmailReplyParser.read(text).reply.strip()


def is_auto_generated(communication) -> bool:
	subject = (communication.subject or "").lower()
	if any(marker in subject for marker in AUTO_REPLY_SUBJECTS):
		return True
	sender = (communication.sender or "").lower()
	return sender.startswith(("mailer-daemon", "postmaster", "no-reply", "noreply"))


def text_to_reply_html(text: str) -> str:
	paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
	return "".join("<p>{}</p>".format(frappe.utils.escape_html(p).replace("\n", "<br>")) for p in paragraphs)


def user_can_reply(topic: str, user: str) -> bool:
	"""Same access rule as replying from the site."""
	from lms.lms.utils import validate_discussion_reply_access

	previous = frappe.session.user
	try:
		frappe.set_user(user)
		validate_discussion_reply_access(topic)
		return True
	except (frappe.ValidationError, frappe.PermissionError):
		return False
	finally:
		frappe.set_user(previous)


def handle_incoming_reply(doc, method=None):
	"""`Communication` after_insert hook: save a reply to a mention email as a Discussion Reply."""
	if doc.communication_type != "Communication" or doc.sent_or_received != "Received":
		return

	token = parse_token(" ".join(filter(None, [doc.recipients, doc.cc, doc.bcc])))
	if not token:
		return
	topic, signature = token

	if not frappe.db.exists("Discussion Topic", topic):
		return

	if is_auto_generated(doc):
		return

	sender_email = (parse_addr(doc.sender or "")[1] or "").lower()
	user = frappe.db.get_value("User", {"email": sender_email, "enabled": 1}, "name") if sender_email else None
	if not user or not hmac.compare_digest(signature, make_signature(topic, user)):
		frappe.log_error(
			title="LMS mail reply rejected",
			message=f"Invalid token or unknown sender {doc.sender} for topic {topic} (Communication {doc.name})",
		)
		return

	if cint(frappe.cache.get_value(f"lms_mail_reply_count:{user}")) >= MAX_REPLIES_PER_HOUR:
		return

	text = extract_reply_text(doc.content or "")
	if not text:
		return

	if not user_can_reply(topic, user):
		frappe.log_error(
			title="LMS mail reply rejected",
			message=f"{user} has no access to topic {topic} (Communication {doc.name})",
		)
		return

	count = cint(frappe.cache.get_value(f"lms_mail_reply_count:{user}")) + 1
	frappe.cache.set_value(f"lms_mail_reply_count:{user}", count, expires_in_sec=3600)

	previous = frappe.session.user
	try:
		frappe.set_user(user)
		reply = frappe.get_doc(
			{"doctype": "Discussion Reply", "topic": topic, "reply": text_to_reply_html(text)}
		)
		reply.insert()
	except (frappe.ValidationError, frappe.PermissionError):
		frappe.log_error(
			title="LMS mail reply rejected",
			message=f"{user} could not post to topic {topic} (Communication {doc.name})",
		)
		return
	finally:
		frappe.set_user(previous)

	frappe.db.set_value(
		"Communication",
		doc.name,
		{"reference_doctype": "Discussion Reply", "reference_name": reply.name},
		update_modified=False,
	)
