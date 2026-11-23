# Copyright (c) 2026, Frappe and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt

OPERATORS = ("<", "<=", ">", ">=")


class LMSAutoMailRule(Document):
	def validate(self):
		frappe.only_for("System Manager")
		if self.operator not in OPERATORS:
			frappe.throw(_("Invalid operator {0}").format(self.operator))
		if not 0 <= flt(self.progress_percent) <= 100:
			frappe.throw(_("Progress percent must be between 0 and 100."))
		if not 1 <= (self.day_of_month or 0) <= 31:
			frappe.throw(_("Day of month must be between 1 and 31."))

	def on_trash(self):
		frappe.only_for("System Manager")
