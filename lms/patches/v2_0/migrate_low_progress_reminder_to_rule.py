import frappe
import frappe.utils

TEMPLATE_NAME = "Low Progress Reminder"


def execute():
	"""The month-end <30% reminder is now an LMS Auto Mail Rule. Keep it running for
	sites that had it switched on, then drop the old setting."""
	# A Single's values live in tabSingles, which still holds the value after the field
	# is removed from the doctype JSON.
	rows = frappe.db.sql(
		"select `value` from `tabSingles` where `doctype`=%s and `field`=%s",
		("LMS Settings", "send_low_progress_reminder"),
	)
	enabled = rows[0][0] if rows else 0
	if not frappe.utils.cint(enabled):
		return

	if not frappe.db.exists("Email Template", TEMPLATE_NAME):
		frappe.get_doc(
			{
				"doctype": "Email Template",
				"name": TEMPLATE_NAME,
				"subject": "Catch up on your course: {{ course }}",
				"use_html": 1,
				"response_html": (
					"<p>Dear {{ student_name }},</p>"
					"<p>This is to share that you have completed about {{ progress }} of the course "
					"<b>{{ course }}</b> so far. While this is a self-paced course, we urge you to invest more "
					"time to catch up with the remaining sessions so you can stay with the cohort.</p>"
					"<p>Please get in touch with us if you are facing any difficulties.</p>"
					"<p>Thanks and regards,<br>Team ES.</p>"
				),
			}
		).insert(ignore_permissions=True)

	if not frappe.db.exists("LMS Auto Mail Rule", {"title": "Month-end low progress reminder"}):
		frappe.get_doc(
			{
				"doctype": "LMS Auto Mail Rule",
				"title": "Month-end low progress reminder",
				"enabled": 1,
				"operator": "<",
				"progress_percent": 30,
				"day_of_month": 31,
				"send_time": "09:00:00",
				"email_template": TEMPLATE_NAME,
			}
		).insert(ignore_permissions=True)

	frappe.db.sql(
		"delete from `tabSingles` where `doctype`=%s and `field`=%s",
		("LMS Settings", "send_low_progress_reminder"),
	)
