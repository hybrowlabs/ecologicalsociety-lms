# Copyright (c) 2021, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.test_helpers import BaseTestUtils


class TestLMSAssignmentSubmission(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.student_a = self._create_user("rtv.student.a@example.com", "Student", "Alpha", ["LMS Student"])
		self.student_b = self._create_user("rtv.student.b@example.com", "Student", "Bravo", ["LMS Student"])
		self.moderator = self._create_user("rtv.moderator@example.com", "Mod", "Erator", ["Moderator"])
		self.assignment = self._create_assignment()

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _new_submission(self, member=None, answer="submission answer"):
		doc = frappe.new_doc("LMS Assignment Submission")
		doc.assignment = self.assignment.name
		if member is not None:
			doc.member = member
		doc.answer = answer
		return doc

	def test_student_cannot_submit_for_another_member(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_b.name)
		with self.assertRaises(frappe.PermissionError):
			doc.insert()

	def test_student_member_defaults_to_session_user(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=None)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_a.name)

	def test_student_can_submit_for_self(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_a.name)

	def test_privileged_user_can_submit_on_behalf_of_member(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_submission(member=self.student_b.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		self.assertEqual(doc.member, self.student_b.name)

	def test_student_cannot_reassign_member_on_update(self):
		frappe.set_user(self.student_a.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		doc.member = self.student_b.name
		with self.assertRaises(frappe.PermissionError):
			doc.save()

	def test_privileged_user_can_reassign_member_on_update(self):
		frappe.set_user(self.moderator.name)
		doc = self._new_submission(member=self.student_a.name)
		doc.insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		doc.member = self.student_b.name
		doc.save()
		self.assertEqual(doc.member, self.student_b.name)


class TestDownloadAssignmentSubmissions(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.student_a = self._create_user("dl.student.a@example.com", "Student", "Alpha", ["LMS Student"])
		self.student_b = self._create_user("dl.student.b@example.com", "Student", "Bravo", ["LMS Student"])
		self.moderator = self._create_user("dl.moderator@example.com", "Mod", "Erator", ["Moderator"])
		self.assignment = frappe.get_doc(
			{
				"doctype": "LMS Assignment",
				"title": "Download Test Assignment",
				"question": "Upload your essay.",
				"type": "Document",
				"grade_assignment": 1,
			}
		).insert()
		self.cleanup_items.append(("LMS Assignment", self.assignment.name))

		file_doc = frappe.get_doc(
			{"doctype": "File", "file_name": "essay.txt", "content": b"my essay", "is_private": 1}
		).insert()
		self.cleanup_items.append(("File", file_doc.name))

		frappe.set_user(self.moderator.name)
		self._submit(self.student_a.name, file_doc.file_url)
		self._submit(self.student_b.name, "/private/files/does-not-exist.pdf")

	def tearDown(self):
		frappe.set_user("Administrator")
		frappe.local.response.pop("filecontent", None)
		super().tearDown()

	def _submit(self, member, attachment):
		doc = frappe.get_doc(
			{
				"doctype": "LMS Assignment Submission",
				"assignment": self.assignment.name,
				"member": member,
				"assignment_attachment": attachment,
			}
		).insert()
		self.cleanup_items.append(("LMS Assignment Submission", doc.name))
		return doc

	def _download(self, **kwargs):
		import io
		import zipfile

		from lms.lms.api import download_assignment_submissions

		download_assignment_submissions(self.assignment.name, **kwargs)
		self.assertEqual(frappe.local.response.type, "download")
		self.assertTrue(frappe.local.response.filename.endswith(".zip"))
		return zipfile.ZipFile(io.BytesIO(frappe.local.response.filecontent))

	def test_moderator_downloads_zip_with_files_and_summary(self):
		zf = self._download()
		names = zf.namelist()
		self.assertIn("summary.csv", names)
		essay = [n for n in names if n.endswith("essay.txt")]
		self.assertEqual(len(essay), 1)
		self.assertIn(self.student_a.name, essay[0])
		self.assertEqual(zf.read(essay[0]), b"my essay")

		summary = zf.read("summary.csv").decode()
		self.assertIn(self.student_b.name, summary)
		self.assertIn("File missing on server", summary)

	def test_member_filter(self):
		zf = self._download(member=self.student_b.name)
		summary = zf.read("summary.csv").decode()
		self.assertNotIn(self.student_a.name, summary)
		self.assertIn(self.student_b.name, summary)

	def test_student_cannot_download(self):
		from lms.lms.api import download_assignment_submissions

		frappe.set_user(self.student_a.name)
		with self.assertRaises(frappe.PermissionError):
			download_assignment_submissions(self.assignment.name)
