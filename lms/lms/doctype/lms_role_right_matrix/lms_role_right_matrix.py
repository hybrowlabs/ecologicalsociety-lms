# Copyright (c) 2026, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSRoleRightMatrix(Document):
	def validate(self):
		duplicate = frappe.db.exists(
			"LMS Role Right Matrix",
			{"role": self.role, "right": self.right, "name": ["!=", self.name]},
		)
		if duplicate:
			frappe.throw(_("A matrix row for {0} / {1} already exists.").format(self.role, self.right))
