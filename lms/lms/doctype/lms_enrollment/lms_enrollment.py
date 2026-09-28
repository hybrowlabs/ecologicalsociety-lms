# Copyright (c) 2021, FOSS United and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import ceil, get_last_day, getdate


class LMSEnrollment(Document):
	def before_insert(self):
		self.validate_duplicate_enrollment()
		self.validate_course_enrollment_eligibility()
		self.validate_owner()

	def validate_owner(self):
		"""Makes the member as the owner of the document so that users can update their progress"""
		if self.owner != self.member:
			self.owner = self.member

	def on_update(self):
		update_program_progress(self.member)

	def after_insert(self):
		self.update_course_enrollments()

	def on_trash(self):
		self.update_course_enrollments(is_deleted=True)

	def update_course_enrollments(self, is_deleted=False):
		try:
			enrollments = frappe.db.count("LMS Enrollment", {"course": self.course, "member_type": "Student"})
			if is_deleted:
				enrollments = max(0, enrollments - 1)
			frappe.db.set_value("LMS Course", self.course, "enrollments", enrollments, update_modified=False)
			frappe.clear_document_cache("LMS Course", self.course)
		except Exception:
			pass

	def validate_duplicate_enrollment(self):
		existing_enrollment = frappe.db.exists(
			"LMS Enrollment",
			{
				"course": self.course,
				"member": self.member,
				"name": ["!=", self.name],
			},
		)

		if existing_enrollment and existing_enrollment != self.name:
			frappe.throw(_("Student is already enrolled in this course."))

	def validate_course_enrollment_eligibility(self):
		course_details = frappe.db.get_value(
			"LMS Course",
			self.course,
			["published", "disable_self_learning", "paid_course", "paid_certificate"],
			as_dict=True,
		)

		if course_details.disable_self_learning and not is_admin():
			frappe.throw(
				_(
					"You cannot enroll in this course as self-learning is disabled. Please contact the Administrator."
				)
			)

		if self.enrollment_from_batch:
			if not frappe.db.exists(
				"Batch Course", {"parent": self.enrollment_from_batch, "course": self.course}
			):
				frappe.throw(_("This batch is not associated with this course."))

			if frappe.db.exists(
				"LMS Batch Enrollment", {"batch": self.enrollment_from_batch, "member": self.member}
			):
				return

		if not course_details.published and not is_admin():
			frappe.throw(_("You cannot enroll in an unpublished course."))

		if course_details.paid_course and not is_admin():
			payment = frappe.db.exists(
				"LMS Payment",
				{
					"payment_for_document_type": "LMS Course",
					"payment_for_document": self.course,
					"member": self.member,
					"payment_received": True,
				},
			)

			if not payment:
				frappe.throw(_("You need to complete the payment for this course before enrolling."))


def is_admin():
	roles = frappe.get_roles(frappe.session.user)
	admin_roles = ["Moderator", "Course Creator", "Batch Evaluator"]
	for role in admin_roles:
		if role in roles:
			return True
	return False


def update_program_progress(member):
	programs = frappe.get_all("LMS Program Member", {"member": member}, ["parent", "name"])

	for program in programs:
		total_progress = 0
		courses = frappe.get_all("LMS Program Course", {"parent": program.parent}, pluck="course")
		for course in courses:
			progress = frappe.db.get_value("LMS Enrollment", {"course": course, "member": member}, "progress")
			progress = progress or 0
			total_progress += progress

		average_progress = ceil(total_progress / len(courses))
		frappe.db.set_value("LMS Program Member", program.name, "progress", average_progress)


LOW_PROGRESS_THRESHOLD = 30


def send_low_progress_reminder():
	"""Runs daily; on the last day of the month, email students whose
	course completion is below LOW_PROGRESS_THRESHOLD percent."""
	if not frappe.db.get_single_value("LMS Settings", "send_low_progress_reminder"):
		return

	today = getdate()
	if today != get_last_day(today):
		return

	outgoing_email_account = frappe.get_cached_value(
		"Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name"
	)
	if not (outgoing_email_account or frappe.conf.get("mail_login")):
		return

	Enrollment = frappe.qb.DocType("LMS Enrollment")
	Course = frappe.qb.DocType("LMS Course")
	User = frappe.qb.DocType("User")
	enrollments = (
		frappe.qb.from_(Enrollment)
		.join(Course)
		.on(Course.name == Enrollment.course)
		.join(User)
		.on(User.name == Enrollment.member)
		.select(Enrollment.member, Course.title)
		.where(
			(Enrollment.progress < LOW_PROGRESS_THRESHOLD)
			& (Course.published == 1)
			& (User.enabled == 1)
			& ((Enrollment.member_type == "Student") | Enrollment.member_type.isnull() | (Enrollment.member_type == ""))
		)
		.run(as_dict=True)
	)

	for enrollment in enrollments:
		try:
			frappe.sendmail(
				recipients=enrollment.member,
				subject=_("Catch up on your course: {0}").format(enrollment.title),
				template="low_progress_reminder",
				args={},
				header=[_("Course Progress Reminder"), "orange"],
				retry=3,
			)
		except Exception:
			frappe.log_error(title=_("Low progress reminder failed for {0}").format(enrollment.member))
