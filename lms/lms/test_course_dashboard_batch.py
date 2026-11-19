# Copyright (c) 2026, Frappe and Contributors
# See license.txt

import frappe

from lms.lms.api import (
	NO_BATCH,
	get_course_batches,
	get_course_progress_distribution,
	get_course_students_progress,
	get_lesson_completion_stats,
)
from lms.lms.test_helpers import BaseTestUtils


class TestCourseDashboardBatchFilter(BaseTestUtils):
	"""The course dashboard can be narrowed to one batch's students."""

	def setUp(self):
		super().setUp()
		frappe.set_user("Administrator")
		try:
			self._setup_data()
		except Exception:
			# tearDown doesn't run when setUp fails; don't leave orphan rows behind
			super().tearDown()
			raise

	def _setup_data(self):
		self._create_user(
			"frappe@example.com", "Frappe", "Admin", ["Moderator", "Course Creator", "Batch Evaluator"]
		)
		self._create_evaluator()
		self.course = self._create_course("Batch Dashboard Course")

		chapter = self._create_chapter("Batch Dashboard Chapter", self.course.name)
		self.lesson = self._create_lesson("Batch Dashboard Lesson", chapter.name, self.course.name)
		chapter.append("lessons", {"lesson": self.lesson.name})
		chapter.save()
		self.course.reload()
		self.course.append("chapters", {"chapter": chapter.name})
		self.course.save()

		self.early = self._create_user("cdb.early@example.com", "Early", "Bird", ["LMS Student"])
		self.joined = self._create_user("cdb.joined@example.com", "Joined", "Batch", ["LMS Student"])
		self.solo = self._create_user("cdb.solo@example.com", "Solo", "Learner", ["LMS Student"])

		# Enrolled in the course BEFORE joining the batch: enrollment_from_batch stays empty
		self._create_enrollment(self.early.name, self.course.name)
		self._create_enrollment(self.solo.name, self.course.name)

		self.batch = self._create_batch(self.course.name, title="Batch Dashboard Batch")
		self._create_batch_enrollment(self.early.name, self.batch.name)
		self._create_batch_enrollment(self.joined.name, self.batch.name)
		# The batch enrollment auto-creates the course enrollment for `joined`
		joined_enrollment = frappe.db.get_value(
			"LMS Enrollment", {"course": self.course.name, "member": self.joined.name}
		)
		self.cleanup_items.insert(0, ("LMS Enrollment", joined_enrollment))

		done = self._create_progress(self.early.name, self.course.name, self.lesson.name)
		frappe.db.set_value("LMS Course Progress", done.name, "status", "Complete")
		done = self._create_progress(self.solo.name, self.course.name, self.lesson.name)
		frappe.db.set_value("LMS Course Progress", done.name, "status", "Complete")

		# Set after the lesson progress, which recalculates enrollment progress on insert
		progress = {self.early.name: 100, self.joined.name: 40, self.solo.name: 10}
		for member, value in progress.items():
			frappe.db.set_value(
				"LMS Enrollment", {"course": self.course.name, "member": member}, "progress", value
			)

	def tearDown(self):
		frappe.set_user("Administrator")
		super().tearDown()

	def _members(self, batch=None):
		result = get_course_students_progress(self.course.name, batch=batch)
		return {row.member for row in result["students"]}, result["total"]

	def test_course_batches_lists_batch_with_member_count(self):
		batches = {b.name: b for b in get_course_batches(self.course.name)}
		self.assertIn(self.batch.name, batches)
		self.assertEqual(batches[self.batch.name].students, 2)

	def test_all_students_is_unchanged(self):
		members, total = self._members()
		self.assertEqual(members, {self.early.name, self.joined.name, self.solo.name})
		self.assertEqual(total, 3)

	def test_batch_filter_counts_members_enrolled_before_joining(self):
		members, total = self._members(self.batch.name)
		self.assertEqual(members, {self.early.name, self.joined.name})
		self.assertEqual(total, 2)

	def test_not_in_any_batch(self):
		members, total = self._members(NO_BATCH)
		self.assertEqual(members, {self.solo.name})
		self.assertEqual(total, 1)

	def test_progress_distribution_for_batch(self):
		data = get_course_progress_distribution(self.course.name, self.batch.name)
		self.assertEqual(data["enrolled"], 2)
		self.assertEqual(data["average_progress"], 70)
		completed = [d for d in data["progress_distribution"] if d["name"].startswith("Completed")][0]
		self.assertEqual(completed["value"], 1)

		everyone = get_course_progress_distribution(self.course.name)
		self.assertEqual(everyone["enrolled"], 3)

	def test_lesson_completion_for_batch(self):
		def count(batch=None):
			rows = get_lesson_completion_stats(self.course.name, batch)
			return {r.lesson_name: r.completion_count for r in rows}[self.lesson.name]

		self.assertEqual(count(), 2)
		self.assertEqual(count(self.batch.name), 1)
		self.assertEqual(count(NO_BATCH), 1)

	def test_batch_without_this_course_is_rejected(self):
		with self.assertRaises(frappe.ValidationError):
			get_course_students_progress(self.course.name, batch="not-a-real-batch")
