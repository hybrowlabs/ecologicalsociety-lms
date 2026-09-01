import frappe


def execute():
	"""Move the single `Course Chapter.instructor` link into the `instructors` table.

	A session can now have several instructors, held in `Course Instructor`
	child rows (the same child doctype the course and batch level already use).
	The old Link field is gone from the doctype, but MariaDB keeps the orphan
	column, so the previous value is still readable here — guard on the column
	in case a cleanup has already dropped it, or the patch reruns.
	"""
	if "instructor" not in frappe.db.get_table_columns("Course Chapter"):
		return

	rows = frappe.db.sql(
		"""
		SELECT name, instructor
		FROM `tabCourse Chapter`
		WHERE IFNULL(instructor, '') != ''
		""",
		as_dict=True,
	)

	for row in rows:
		# Rerunnable: skip a chapter whose instructor was already carried over.
		if frappe.db.exists(
			"Course Instructor",
			{
				"parenttype": "Course Chapter",
				"parent": row.name,
				"instructor": row.instructor,
			},
		):
			continue

		if not frappe.db.exists("User", row.instructor):
			continue

		child = frappe.new_doc("Course Instructor")
		child.update(
			{
				"instructor": row.instructor,
				"parent": row.name,
				"parenttype": "Course Chapter",
				"parentfield": "instructors",
				"idx": 1,
			}
		)
		child.insert(ignore_permissions=True)
