from unittest.mock import patch

import frappe
from frappe.utils import get_datetime, getdate

from lms.lms.api import get_auto_mail_recipients, send_auto_mail_test
from lms.lms.auto_mail import effective_day, get_matching_students, run_auto_mail_rules, run_rule
from lms.lms.test_helpers import BaseTestUtils

TEMPLATE = "Auto Mail Test Template"


class TestAutoMail(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator"])
		self._create_evaluator()
		self.course = self._create_course("Auto Mail Course")
		self.low = self._create_user("am.low@example.com", "Low", "Student", ["LMS Student"])
		self.high = self._create_user("am.high@example.com", "High", "Student", ["LMS Student"])
		for user, progress in ((self.low, 10), (self.high, 90)):
			self._create_enrollment(user.name, self.course.name)
			frappe.db.set_value(
				"LMS Enrollment", {"member": user.name, "course": self.course.name}, "progress", progress
			)
		if not frappe.db.exists("Email Template", TEMPLATE):
			frappe.get_doc(
				{
					"doctype": "Email Template",
					"name": TEMPLATE,
					"subject": "Hello {{ student_name }}",
					"response": "You are at {{ progress }} in {{ course }}",
				}
			).insert()
			self.cleanup_items.append(("Email Template", TEMPLATE))
		self.rules = []

	def tearDown(self):
		for rule in self.rules:
			frappe.db.delete("LMS Auto Mail Log", {"rule": rule.name})
			frappe.delete_doc("LMS Auto Mail Rule", rule.name, force=True)
		super().tearDown()

	def _rule(self, operator="<", percent=30, day=None, send_time="00:00:00", **extra):
		rule = frappe.get_doc(
			{
				"doctype": "LMS Auto Mail Rule",
				"title": f"rule {operator}{percent}",
				"enabled": 1,
				"course": self.course.name,
				"operator": operator,
				"progress_percent": percent,
				"day_of_month": day or getdate().day,
				"send_time": send_time,
				"email_template": TEMPLATE,
				**extra,
			}
		).insert()
		self.rules.append(rule)
		return rule

	def _members(self, rule):
		return {r.member for r in get_matching_students(rule)}

	def test_operators(self):
		self.assertEqual(self._members(self._rule("<", 30)), {self.low.name})
		self.assertEqual(self._members(self._rule(">", 30)), {self.high.name})
		self.assertEqual(self._members(self._rule("<=", 10)), {self.low.name})
		self.assertEqual(self._members(self._rule(">=", 90)), {self.high.name})

	def test_effective_day_falls_back_to_month_end(self):
		self.assertEqual(effective_day(31, getdate("2026-02-10")), 28)
		self.assertEqual(effective_day(31, getdate("2026-04-10")), 30)
		self.assertEqual(effective_day(31, getdate("2026-05-10")), 31)
		self.assertEqual(effective_day(15, getdate("2026-02-10")), 15)

	def test_sends_once_and_dedupes(self):
		rule = self._rule("<", 30)
		with patch("frappe.sendmail") as sendmail:
			self.assertEqual(run_rule(rule), 1)
			self.assertEqual(run_rule(rule), 0)
		sendmail.assert_called_once()
		self.assertEqual(sendmail.call_args.kwargs["recipients"], [self.low.name])
		self.assertIn("Hello Low Student", sendmail.call_args.kwargs["subject"])
		self.assertIn("10%", sendmail.call_args.kwargs["content"])

	def test_scheduler_respects_day_time_and_enabled(self):
		today = getdate()
		wrong_day = self._rule("<", 30, day=1 if today.day != 1 else 2)
		later = self._rule("<", 30, send_time="23:59:59")
		off = self._rule("<", 30, enabled=0)
		on = self._rule("<", 30)
		morning = get_datetime(f"{today} 08:00:00")
		with patch("frappe.sendmail"), patch("lms.lms.auto_mail.has_outgoing_email", return_value=True):
			run_auto_mail_rules(now=morning)
			for rule in (wrong_day, later, off):
				self.assertFalse(frappe.db.get_value("LMS Auto Mail Rule", rule.name, "last_run_on"))
			self.assertEqual(getdate(frappe.db.get_value("LMS Auto Mail Rule", on.name, "last_run_on")), today)

	def test_no_outgoing_account_sends_nothing(self):
		rule = self._rule("<", 30)
		with patch("frappe.sendmail") as sendmail, patch(
			"lms.lms.auto_mail.has_outgoing_email", return_value=False
		):
			run_auto_mail_rules(now=get_datetime(f"{getdate()} 12:00:00"))
		sendmail.assert_not_called()
		self.assertFalse(frappe.db.get_value("LMS Auto Mail Rule", rule.name, "last_run_on"))

	def test_only_system_manager_can_manage_rules(self):
		rule = self._rule("<", 30)
		frappe.set_user("frappe@example.com")  # Moderator, not a System Manager
		try:
			with self.assertRaises(frappe.PermissionError):
				get_auto_mail_recipients(rule.name)
			with self.assertRaises(frappe.PermissionError):
				send_auto_mail_test(rule.name)
			with self.assertRaises(frappe.PermissionError):
				frappe.get_doc(
					{
						"doctype": "LMS Auto Mail Rule",
						"title": "nope",
						"operator": "<",
						"progress_percent": 10,
						"day_of_month": 1,
						"email_template": TEMPLATE,
					}
				).insert()
		finally:
			frappe.set_user("Administrator")

	def test_validation(self):
		with self.assertRaises(frappe.ValidationError):
			self._rule("<", 150)
		with self.assertRaises(frappe.ValidationError):
			self._rule("<", 10, day=32)
