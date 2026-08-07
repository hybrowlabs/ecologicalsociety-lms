import frappe


def execute():
	"""Mark every chapter that predates the draft/publish feature as Published.

	The `status` field is new, so existing rows come out of the schema sync with
	an empty value. Backfilling them keeps already-live course content visible
	and the UI badge coherent; only chapters created from here on default to
	Draft (see CourseChapter.before_insert).
	"""
	chapter = frappe.qb.DocType("Course Chapter")
	(
		frappe.qb.update(chapter)
		.set(chapter.status, "Published")
		.where(chapter.status.isnull() | (chapter.status == ""))
	).run()
