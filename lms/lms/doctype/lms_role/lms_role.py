# Copyright (c) 2026, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document


class LMSRole(Document):
	def on_trash(self):
		if self.is_system_role:
			frappe.throw(_("{0} is a system role and cannot be deleted.").format(self.role_name))
