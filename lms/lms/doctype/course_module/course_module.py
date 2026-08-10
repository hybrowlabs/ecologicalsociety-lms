# Copyright (c) 2026, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CourseModule(Document):
	def on_trash(self):
		"""Deleting a module must never delete the sessions inside it.

		A module is a grouping layer over `Course Chapter`, so tearing one down
		only unlinks its chapters (they fall back to the ungrouped bucket) and
		drops the ordering row on the course.
		"""
		frappe.db.set_value("Course Chapter", {"module": self.name}, "module", None, update_modified=False)
		frappe.db.delete("Module Reference", {"module": self.name})
