# Copyright (c) 2026, FOSS United and contributors
# For license information, please see license.txt

"""Central scoped role/rights engine.

Replaces the old flat, global 4-role model (`lms.lms.utils.LMS_ROLES`) with a
configurable role x right x scope matrix (`LMS Role Right Matrix`) and
per-user scoped grants (`LMS User Role`). See the "Scoped Role & Rights
System" plan for the full design and phased rollout.

This module is dark-launched in Phase 1: nothing in the app calls it yet.
Existing call sites are migrated onto it in a later phase, with a
`LMS Settings.legacy_role_fallback_enabled` safety net for any user who has
not yet been migrated to `LMS User Role` records.
"""

import frappe

RIGHT_ADMIN = "Admin"
RIGHT_CREATION_AND_TESTING = "Creation and Testing"
RIGHT_EVALUATION = "Evaluation"
RIGHT_COORDINATION = "Coordination"

ROLE_MASTER_ADMIN = "MasterAdmin"
ROLE_COURSE_CREATOR = "Course Creator"
ROLE_COURSE_COORDINATOR = "Course Coordinator"
ROLE_CORE_FACULTY = "Core Faculty"
ROLE_GUEST_FACULTY = "Guest Faculty"
ROLE_STUDENT = "Student"

SCOPE_TO_MATRIX_COLUMN = {
	"All Courses": "scope_all_courses",
	"All Batches": "scope_all_batches",
	"Specific Course": "scope_specific_course",
	"Specific Batch": "scope_specific_batch",
}


def has_right(right: str, course: str | None = None, batch: str | None = None, user: str | None = None) -> bool:
	"""Does `user` hold `right`, optionally scoped to a course and/or batch?

	When both `course` and `batch` are given, a grant on either is enough —
	batch-scoped and course-scoped grants are independent of one another (a
	batch grant does not imply access to the courses inside that batch, and
	vice versa).
	"""
	user = user or frappe.session.user

	if user == "Administrator" or frappe.db.exists("Has Role", {"parent": user, "role": "System Manager"}):
		return True

	user_roles = _get_active_user_roles(user)
	if not user_roles:
		if _legacy_fallback_enabled():
			return _legacy_has_right(right, course=course, batch=batch, user=user)
		return False

	for user_role in user_roles:
		matrix_row = _get_matrix_row(user_role.role, right)
		if matrix_row and _scope_satisfies(user_role, matrix_row, course, batch):
			return True

	return False


def can_administer(course: str | None = None, batch: str | None = None, user: str | None = None) -> bool:
	return has_right(RIGHT_ADMIN, course=course, batch=batch, user=user)


def can_create_or_test(course: str | None = None, batch: str | None = None, user: str | None = None) -> bool:
	return has_right(RIGHT_CREATION_AND_TESTING, course=course, batch=batch, user=user)


def can_evaluate(course: str | None = None, batch: str | None = None, user: str | None = None) -> bool:
	return has_right(RIGHT_EVALUATION, course=course, batch=batch, user=user)


def can_coordinate(course: str | None = None, batch: str | None = None, user: str | None = None) -> bool:
	return has_right(RIGHT_COORDINATION, course=course, batch=batch, user=user)


def is_staff(user: str | None = None) -> bool:
	"""Does `user` hold any of the 5 non-Student roles (MasterAdmin, Course
	Creator, Course Coordinator, Core Faculty, Guest Faculty), in any scope?

	This is the new-model equivalent of the old "is this a Moderator/Course
	Creator/Batch Evaluator" staff check that several call sites (in this app
	and in apps built on top of it, e.g. `ecological_society`) use to decide
	whether someone sees the full catalogue vs. only their own enrollments.
	"""
	user = user or frappe.session.user
	if user == "Administrator" or frappe.db.exists("Has Role", {"parent": user, "role": "System Manager"}):
		return True

	user_roles = _get_active_user_roles(user)
	if user_roles:
		return any(role.role != ROLE_STUDENT for role in user_roles)

	if _legacy_fallback_enabled():
		legacy_staff_roles = ("Moderator", "Course Creator", "Batch Evaluator")
		return any(
			frappe.db.exists("Has Role", {"parent": user, "role": role}) for role in legacy_staff_roles
		)

	return False


def is_master_admin(user: str | None = None) -> bool:
	user = user or frappe.session.user
	if user == "Administrator":
		return True

	if frappe.db.exists("LMS User Role", {"user": user, "role": ROLE_MASTER_ADMIN, "is_active": 1}):
		return True

	if not _get_active_user_roles(user) and _legacy_fallback_enabled():
		return bool(frappe.db.get_value("Has Role", {"parent": user, "role": "Moderator"}, "name"))

	return False


def clear_cache():
	"""Drop the per-request matrix/assignment caches. Call after editing the
	matrix or a user's scoped roles within the same request."""
	if hasattr(frappe.local, "_lms_role_right_matrix_cache"):
		del frappe.local._lms_role_right_matrix_cache
	if hasattr(frappe.local, "_lms_user_role_cache"):
		del frappe.local._lms_user_role_cache


def _get_matrix_row(role: str, right: str) -> dict | None:
	cache = getattr(frappe.local, "_lms_role_right_matrix_cache", None)
	if cache is None:
		cache = {}
		rows = frappe.get_all(
			"LMS Role Right Matrix",
			fields=[
				"role",
				"right",
				"scope_all_courses",
				"scope_all_batches",
				"scope_specific_course",
				"scope_specific_batch",
			],
		)
		for row in rows:
			cache[(row.role, row.right)] = row
		frappe.local._lms_role_right_matrix_cache = cache

	return cache.get((role, right))


def _get_active_user_roles(user: str) -> list:
	cache = getattr(frappe.local, "_lms_user_role_cache", None)
	if cache is None:
		cache = {}
		frappe.local._lms_user_role_cache = cache

	if user not in cache:
		cache[user] = frappe.get_all(
			"LMS User Role",
			filters={"user": user, "is_active": 1},
			fields=["role", "scope_type", "course", "batch"],
		)

	return cache[user]


def _scope_satisfies(user_role: dict, matrix_row: dict, course: str | None, batch: str | None) -> bool:
	scope_type = user_role.scope_type
	column = SCOPE_TO_MATRIX_COLUMN.get(scope_type)
	if not column or not matrix_row.get(column):
		return False

	if course is None and batch is None:
		return True

	if course is not None:
		if scope_type == "All Courses":
			return True
		if scope_type == "Specific Course" and user_role.course == course:
			return True

	if batch is not None:
		if scope_type == "All Batches":
			return True
		if scope_type == "Specific Batch" and user_role.batch == batch:
			return True

	return False


def _legacy_fallback_enabled() -> bool:
	value = frappe.db.get_single_value("LMS Settings", "legacy_role_fallback_enabled")
	return True if value is None else bool(value)


def _legacy_has_right(right: str, course: str | None, batch: str | None, user: str) -> bool:
	"""Pre-migration fallback, expressed directly against the old `Has Role` /
	`Course Instructor` data rather than `lms.lms.utils` helpers, to keep this
	dark-launched module decoupled until it is actually wired in."""
	if frappe.db.exists("Has Role", {"parent": user, "role": "Moderator"}):
		return True

	if right == RIGHT_CREATION_AND_TESTING and frappe.db.exists(
		"Has Role", {"parent": user, "role": "Course Creator"}
	):
		return True

	if right == RIGHT_EVALUATION and frappe.db.exists("Has Role", {"parent": user, "role": "Batch Evaluator"}):
		return True

	if course and frappe.db.exists(
		"Course Instructor", {"parenttype": "LMS Course", "parent": course, "instructor": user}
	):
		return True

	if batch and frappe.db.exists(
		"Course Instructor", {"parenttype": "LMS Batch", "parent": batch, "instructor": user}
	):
		return True

	return False
