import frappe


def execute():
	"""Course Instructor rows can exist for a user who never held the legacy
	Course Creator/Batch Evaluator role (instructor assignment and role grant
	are independent actions in the old system) — the role-based migration in
	`migrate_has_role_to_lms_user_role` misses those. Reconcile any gaps here,
	defaulting to Core Faculty and flagging for review since the correct role
	can't be inferred from a bare instructor assignment.
	"""
	rows = frappe.get_all("Course Instructor", fields=["instructor", "parent", "parenttype"])

	for row in rows:
		if not row.instructor or row.parenttype not in ("LMS Course", "LMS Batch"):
			continue
		if not frappe.db.exists("User", row.instructor):
			continue

		scope_type = "Specific Course" if row.parenttype == "LMS Course" else "Specific Batch"
		course = row.parent if row.parenttype == "LMS Course" else None
		batch = row.parent if row.parenttype == "LMS Batch" else None

		already_covered = frappe.db.exists(
			"LMS User Role",
			{"user": row.instructor, "scope_type": scope_type, "course": course, "batch": batch},
		)
		if already_covered:
			continue

		_create_grant(row.instructor, "Core Faculty", scope_type, course=course, batch=batch)
		_log_review(
			row.instructor,
			f"Course Instructor ({row.parenttype})",
			"Core Faculty",
			"Had a Course Instructor assignment with no matching legacy role (Course Creator/Batch "
			"Evaluator); defaulted to Core Faculty for this scope. Review and correct if a different "
			"role fits better.",
		)


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
