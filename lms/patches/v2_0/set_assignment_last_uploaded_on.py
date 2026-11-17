import frappe


def execute():
	"""Existing submissions: the best known upload time is when they were created."""
	frappe.db.sql(
		"""
		UPDATE `tabLMS Assignment Submission`
		SET last_uploaded_on = creation
		WHERE last_uploaded_on IS NULL
		"""
	)
