import frappe
from frappe.tests import IntegrationTestCase

from lms.lms.mention_mail import (
	extract_reply_text,
	handle_incoming_reply,
	make_signature,
	parse_token,
)


class TestMentionMail(IntegrationTestCase):
	def test_signature_is_bound_to_topic_and_user(self):
		sig = make_signature("abc123", "a@example.com")
		self.assertEqual(sig, make_signature("abc123", "A@example.com"))
		self.assertNotEqual(sig, make_signature("abc123", "b@example.com"))
		self.assertNotEqual(sig, make_signature("other", "a@example.com"))

	def test_parse_token(self):
		sig = make_signature("abc123", "a@example.com")
		self.assertEqual(parse_token(f"Team <lms+abc123.{sig}@example.org>"), ("abc123", sig))
		self.assertIsNone(parse_token("lms@example.org"))
		self.assertIsNone(parse_token(None))

	def test_extract_reply_text_drops_quoted_history(self):
		html = (
			"<div>Yes, use chapter 2.</div>"
			'<div class="gmail_quote"><div>On Mon, X wrote:</div>'
			"<blockquote>What should I read?</blockquote></div>"
		)
		self.assertEqual(extract_reply_text(html), "Yes, use chapter 2.")

	def test_extract_reply_text_plain(self):
		text = "Thanks, done.\n\nOn Mon, X wrote:\n> old message"
		self.assertEqual(extract_reply_text(text), "Thanks, done.")

	def test_reply_is_saved_against_topic(self):
		enrollment = frappe.db.get_value("LMS Enrollment", {}, ["member", "course"], as_dict=True)
		if not enrollment:
			self.skipTest("No enrollment available")
		user = enrollment.member
		lesson = frappe.db.get_value("Course Lesson", {"course": enrollment.course}, "name")
		if not lesson:
			self.skipTest("No Course Lesson available")

		frappe.set_user(user)
		try:
			topic = frappe.get_doc(
				{
					"doctype": "Discussion Topic",
					"reference_doctype": "Course Lesson",
					"reference_docname": lesson,
					"title": "Mail reply test",
				}
			).insert(ignore_permissions=True)
		finally:
			frappe.set_user("Administrator")

		def make_comm(sender, signature):
			return frappe._dict(
				communication_type="Communication",
				sent_or_received="Received",
				recipients=f"lms+{topic.name}.{signature}@example.org",
				cc=None,
				bcc=None,
				sender=sender,
				subject="Re: mention",
				content="<div>Answered by email</div>",
				name=None,
			)

		# a wrong signature is rejected
		handle_incoming_reply(make_comm(user, "0" * 20))
		self.assertFalse(frappe.db.exists("Discussion Reply", {"topic": topic.name}))

		# an auto reply is rejected
		auto = make_comm(user, make_signature(topic.name, user))
		auto.subject = "Out of office"
		handle_incoming_reply(auto)
		self.assertFalse(frappe.db.exists("Discussion Reply", {"topic": topic.name}))

		# a valid reply from the mentioned user is stored
		handle_incoming_reply(make_comm(user, make_signature(topic.name, user)))
		reply = frappe.db.get_value("Discussion Reply", {"topic": topic.name}, ["reply", "owner"], as_dict=True)
		self.assertIsNotNone(reply)
		self.assertIn("Answered by email", reply.reply)
		self.assertEqual(reply.owner, user)
