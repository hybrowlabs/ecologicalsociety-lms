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

	def validate(self):
		self.deduplicate_instructors()

	def deduplicate_instructors(self):
		"""Keep at most one row per user, in the order they were added.

		A session can be taught by several people, but the same person twice is
		always a mistake — and it would render as a duplicate name in the
		outline.
		"""
		seen = set()
		rows = []
		for row in self.instructors:
			if not row.instructor or row.instructor in seen:
				continue
			seen.add(row.instructor)
			row.idx = len(rows) + 1
			rows.append(row)
		self.instructors = rows

	def on_update(self):
		self.update_lesson_count()

	def update_lesson_count(self):
		"""Update lesson count in the course"""
		frappe.db.set_value("LMS Course", self.course, "lessons", get_lesson_count(self.course))
