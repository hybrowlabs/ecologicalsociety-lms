# Copyright (c) 2026, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSUserRole(Document):
	"""A scoped grant of an `LMS Role` to a user.

	Which of the 4 scope types (All Courses / All Batches / Specific Course /
	Specific Batch) makes sense for a given role is guided by that role's rows
	in `LMS Role Right Matrix` — but that guidance is enforced client-side (the
	Roles & Permissions UI only offers the scopes the matrix grants a right
	for), not here. A role like Student legitimately has an all-zero matrix
	(it grants none of the 4 administrative rights) while still needing a
	scope recorded for identity/membership purposes, so this doctype must not
	reject a scope assignment just because the matrix currently grants
	nothing there.
	"""

	def validate(self):
		self.validate_scope_fields()
		self.validate_duplicate()

	def validate_scope_fields(self):
		if self.scope_type == "Specific Course":
			if not self.course:
				frappe.throw(_("Course is required when scope is Specific Course."))
			self.batch = None
		elif self.scope_type == "Specific Batch":
			if not self.batch:
				frappe.throw(_("Batch is required when scope is Specific Batch."))
			self.course = None
		else:
			self.course = None
			self.batch = None

	def validate_duplicate(self):
		filters = {
			"user": self.user,
			"role": self.role,
			"scope_type": self.scope_type,
			"course": self.course,
			"batch": self.batch,
			"name": ["!=", self.name],
		}
		if frappe.db.exists("LMS User Role", filters):
			frappe.throw(_("This role assignment already exists for this user."))
