from unittest.mock import patch

import frappe

from lms.lms.api import get_lagging_students, send_batch_student_message
from lms.lms.test_helpers import BaseTestUtils


class TestBatchStudentMessage(BaseTestUtils):
	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		self._create_user("frappe@example.com", "Frappe", "Admin", ["Moderator"])
		self._create_evaluator()
		self.course = self._create_course("Message Course")
		self.batch = self._create_batch(self.course.name)
		self.s1 = self._create_user("msg.one@example.com", "One", "Student", ["LMS Student"])
		self.s2 = self._create_user("msg.two@example.com", "Two", "Student", ["LMS Student"])
		self.outsider = self._create_user("msg.out@example.com", "Out", "Sider", ["LMS Student"])
		self._create_batch_enrollment(self.s1.name, self.batch.name)
		self._create_batch_enrollment(self.s2.name, self.batch.name)
		self._create_enrollment(self.s1.name, self.course.name)
		frappe.db.set_value(
			"LMS Enrollment", {"member": self.s1.name, "course": self.course.name}, "progress", 80
		)

	def tearDown(self):
		frappe.db.delete("LMS Batch Message Log", {"batch": self.batch.name})
		super().tearDown()

	def test_lagging_students_only_below_threshold(self):
		members = [s.member for s in get_lagging_students(self.batch.name)]
		self.assertIn(self.s2.name, members)
		self.assertNotIn(self.s1.name, members)

	def test_message_logged_only_for_selected(self):
		with patch("frappe.sendmail") as sendmail:
			send_batch_student_message(
				self.batch.name, [self.s2.name], "Hi {{ student_name }}", "Catch up", 1, 1
			)
		sendmail.assert_called_once()
		self.assertEqual(sendmail.call_args.kwargs["recipients"], [self.s2.name])
		logs = frappe.get_all("LMS Batch Message Log", {"batch": self.batch.name}, ["recipient", "subject"])
		self.assertEqual([l.recipient for l in logs], [self.s2.name])
		self.assertIn("Two", logs[0].subject)

	def test_rejects_non_enrolled_recipient(self):
		with self.assertRaises(frappe.ValidationError):
			send_batch_student_message(self.batch.name, [self.outsider.name], "Hi", "Hello")

	def test_requires_batch_permission(self):
		frappe.set_user(self.s1.name)
		with self.assertRaises(frappe.PermissionError):
			send_batch_student_message(self.batch.name, [self.s2.name], "Hi", "Hello")

	def test_course_placeholders(self):
		with patch("frappe.sendmail") as sendmail:
			send_batch_student_message(
				self.batch.name, [self.s2.name], "{{ courses }}", "Pending: {{ pending_courses }}", 1, 0
			)
		self.assertEqual(sendmail.call_args.kwargs["subject"], self.course.title)
		self.assertIn(self.course.title, sendmail.call_args.kwargs["args"]["message"])
