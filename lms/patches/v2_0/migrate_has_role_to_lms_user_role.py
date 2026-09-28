import frappe


def execute():
	"""Convert legacy `Has Role` grants (Moderator/Course Creator/Batch
	Evaluator/LMS Student) into scoped `LMS User Role` records against the new
	6-role model. Rerunnable: every write is guarded by an existence check.

	Course Instructor / Course Evaluator / Batch Course.evaluator rows are
	read here to derive scope, but are not deleted or altered — they remain
	the legacy fallback data source until the new engine's enforcement
	cutover (a later phase) is confirmed safe.
	"""
	migrate_moderators()
	migrate_course_creators()
	migrate_batch_evaluators()
	migrate_students()


def migrate_moderators():
	for user in _role_holders("Moderator"):
		_create_grant(user, "MasterAdmin", "All Courses")
		_create_grant(user, "MasterAdmin", "All Batches")


def migrate_course_creators():
	for user in _role_holders("Course Creator"):
		instructor_rows = frappe.get_all(
			"Course Instructor", filters={"instructor": user}, fields=["parent", "parenttype"]
		)

		if not instructor_rows:
			_log_review(
				user,
				"Course Creator",
				"Course Creator",
				"No Course Instructor rows found to derive a scope from; needs manual scoped-role assignment.",
			)
			continue

		for row in instructor_rows:
			if row.parenttype == "LMS Course":
				_create_grant(user, "Course Creator", "Specific Course", course=row.parent)
			elif row.parenttype == "LMS Batch":
				_create_grant(user, "Course Creator", "Specific Batch", batch=row.parent)


def migrate_batch_evaluators():
	"""Batch Evaluator has no equivalent split in the old data between "core"
	and "guest" faculty, so every existing evaluator defaults to Core Faculty
	and is logged for manual review (some may actually belong as Guest
	Faculty)."""
	for user in _role_holders("Batch Evaluator"):
		evaluator_name = frappe.db.get_value("Course Evaluator", {"evaluator": user}, "name")

		if evaluator_name:
			for row in frappe.get_all("Batch Course", filters={"evaluator": evaluator_name}, fields=["parent"]):
				_create_grant(user, "Core Faculty", "Specific Batch", batch=row.parent)

		instructor_rows = frappe.get_all(
			"Course Instructor", filters={"instructor": user}, fields=["parent", "parenttype"]
		)
		for row in instructor_rows:
			if row.parenttype == "LMS Course":
				_create_grant(user, "Core Faculty", "Specific Course", course=row.parent)
			elif row.parenttype == "LMS Batch":
				_create_grant(user, "Core Faculty", "Specific Batch", batch=row.parent)

		_log_review(
			user,
			"Batch Evaluator",
			"Core Faculty",
			"Auto-migrated from Batch Evaluator, defaulted to Core Faculty. Review whether this user "
			"should instead be Guest Faculty.",
		)


def migrate_students():
	for user in _role_holders("LMS Student"):
		_create_grant(user, "Student", "All Courses")
		_create_grant(user, "Student", "All Batches")


def _role_holders(role: str) -> list:
	users = frappe.get_all("Has Role", filters={"role": role, "parenttype": "User"}, pluck="parent")
	return [user for user in users if frappe.db.exists("User", user)]


def _create_grant(user: str, role: str, scope_type: str, course: str | None = None, batch: str | None = None):
	filters = {"user": user, "role": role, "scope_type": scope_type, "course": course, "batch": batch}
	if frappe.db.exists("LMS User Role", filters):
		return

	doc = frappe.new_doc("LMS User Role")
	doc.update(filters)
	doc.insert(ignore_permissions=True)


def _log_review(user: str, legacy_role: str, assigned_role: str, notes: str):
	if frappe.db.exists("LMS Role Migration Review", {"user": user, "legacy_role": legacy_role}):
		return

	frappe.get_doc(
		{
			"doctype": "LMS Role Migration Review",
			"user": user,
			"legacy_role": legacy_role,
			"assigned_role": assigned_role,
			"notes": notes,
		}
	).insert(ignore_permissions=True)
