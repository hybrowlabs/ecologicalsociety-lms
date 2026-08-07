# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from lms.lms.utils import get_lesson_count


class CourseChapter(Document):
	def before_insert(self):
		# New chapters start as drafts so an already published course can keep
		# receiving content without it going live the moment it is created.
		# The default deliberately lives here and NOT on the Select field: a
		# doctype-level default makes Frappe emit `ADD COLUMN ... DEFAULT
		# 'Draft'`, and MariaDB backfills existing rows with it — which would
		# silently unpublish every chapter that existed before this feature.
		if not self.status:
			self.status = "Draft"

	def on_update(self):
		self.update_lesson_count()

	def update_lesson_count(self):
		"""Update lesson count in the course"""
		frappe.db.set_value("LMS Course", self.course, "lessons", get_lesson_count(self.course))
