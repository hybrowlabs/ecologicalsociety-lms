# Copyright (c) 2026, FOSS United and Contributors
# See license.txt

import frappe

from lms.lms.permissions import (
	can_administer,
	can_coordinate,
	can_create_or_test,
	can_evaluate,
	is_master_admin,
)
from lms.lms.test_helpers import BaseTestUtils


class TestPermissions(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self._create_user("frappe@example.com", "Frappe", "Admin", [])
		self.course = self._create_course(title="Permissions Test Course")
		self.other_course = self._create_course(title="Permissions Test Other Course")
		self.evaluator = self._create_evaluator()
		self.batch = self._create_batch(self.course.name, title="Permissions Test Batch")

	def test_administrator_is_always_master_admin(self):
		self.assertTrue(is_master_admin("Administrator"))
		self.assertTrue(can_administer(course=self.course.name, user="Administrator"))

	def test_master_admin_has_every_right_everywhere(self):
		user = self._create_user("master-admin@example.com", "Master", "Admin", [])
		self._create_scoped_role(user.name, "MasterAdmin", "All Courses")
		self._create_scoped_role(user.name, "MasterAdmin", "All Batches")

		self.assertTrue(is_master_admin(user.name))
		for check in (can_administer, can_create_or_test, can_evaluate, can_coordinate):
			self.assertTrue(check(user=user.name))
			self.assertTrue(check(course=self.course.name, user=user.name))
			self.assertTrue(check(batch=self.batch.name, user=user.name))

	def test_course_creator_scoped_to_specific_course(self):
		user = self._create_user("course-creator@example.com", "Course", "Creator", [])
		self._create_scoped_role(user.name, "Course Creator", "Specific Course", course=self.course.name)

		self.assertTrue(can_create_or_test(course=self.course.name, user=user.name))
		self.assertTrue(can_administer(course=self.course.name, user=user.name))
		self.assertFalse(can_create_or_test(course=self.other_course.name, user=user.name))
		self.assertFalse(can_coordinate(course=self.course.name, user=user.name))

	def test_batch_and_course_scopes_are_independent(self):
		user = self._create_user("batch-scoped-creator@example.com", "Batch", "Creator", [])
		self._create_scoped_role(user.name, "Course Creator", "Specific Batch", batch=self.batch.name)

		self.assertTrue(can_create_or_test(batch=self.batch.name, user=user.name))
		# The batch contains `self.course`, but a batch-scoped grant must not
		# leak into course-scoped access (per the independent-scope design).
		self.assertFalse(can_create_or_test(course=self.course.name, user=user.name))

	def test_core_faculty_evaluation_scope(self):
		user = self._create_user("core-faculty@example.com", "Core", "Faculty", [])
		self._create_scoped_role(user.name, "Core Faculty", "Specific Batch", batch=self.batch.name)

		self.assertTrue(can_evaluate(batch=self.batch.name, user=user.name))
		self.assertFalse(can_evaluate(course=self.course.name, user=user.name))
		self.assertFalse(can_administer(batch=self.batch.name, user=user.name))

	def test_user_with_no_scoped_roles_and_no_legacy_grants_has_no_rights(self):
		user = self._create_user("nobody@example.com", "No", "Rights", [])
		self.assertFalse(can_administer(user=user.name))
		self.assertFalse(can_create_or_test(user=user.name))
		self.assertFalse(can_evaluate(user=user.name))
		self.assertFalse(can_coordinate(user=user.name))

	def test_legacy_fallback_for_unmigrated_moderator(self):
		user = self._create_user("legacy-moderator@example.com", "Legacy", "Moderator", ["Moderator"])
		frappe.db.set_single_value("LMS Settings", "legacy_role_fallback_enabled", 1)

		self.assertTrue(can_administer(user=user.name))

		frappe.db.set_single_value("LMS Settings", "legacy_role_fallback_enabled", 0)
		self.assertFalse(can_administer(user=user.name))

		frappe.db.set_single_value("LMS Settings", "legacy_role_fallback_enabled", 1)
