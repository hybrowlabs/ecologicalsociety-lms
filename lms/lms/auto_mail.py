"""Scheduled, rule-driven progress emails (see LMS Auto Mail Rule)."""

import frappe
from frappe import _
from frappe.email.doctype.email_template.email_template import get_email_template
from frappe.utils import flt, get_first_day, get_last_day, get_time, getdate, now_datetime

OPERATORS = {
	"<": lambda column, value: column < value,
	"<=": lambda column, value: column <= value,
	">": lambda column, value: column > value,
	">=": lambda column, value: column >= value,
}


def effective_day(day_of_month, today) -> int:
	"""Days 29-31 fall back to the last day of shorter months."""
	return min(int(day_of_month), get_last_day(today).day)


def has_outgoing_email() -> bool:
	account = frappe.get_cached_value("Email Account", {"default_outgoing": 1, "enable_outgoing": 1}, "name")
	return bool(account or frappe.conf.get("mail_login"))


def get_matching_students(rule, limit: int | None = None) -> list:
	"""Enrollments (one row per student and course) that satisfy the rule's condition."""
	Enrollment = frappe.qb.DocType("LMS Enrollment")
	Course = frappe.qb.DocType("LMS Course")
	User = frappe.qb.DocType("User")
	query = (
		frappe.qb.from_(Enrollment)
		.join(Course)
		.on(Course.name == Enrollment.course)
		.join(User)
		.on(User.name == Enrollment.member)
		.select(
			Enrollment.member,
			User.full_name.as_("member_name"),
			Enrollment.course,
			Course.title.as_("course_title"),
			Enrollment.progress,
		)
		.where(
			OPERATORS[rule.operator](Enrollment.progress, flt(rule.progress_percent))
			& (Course.published == 1)
			& (User.enabled == 1)
			& (
				(Enrollment.member_type == "Student")
				| Enrollment.member_type.isnull()
				| (Enrollment.member_type == "")
			)
		)
	)
	if rule.course:
		query = query.where(Enrollment.course == rule.course)
	if limit:
		query = query.limit(limit)
	return query.run(as_dict=True)


def render_mail(rule, student) -> dict:
	args = {
		"student_name": student.member_name or student.member,
		"course": student.course_title,
		"progress": f"{flt(student.progress, 2):g}%",
	}
	return get_email_template(rule.email_template, args)


def run_rule(rule, today=None) -> int:
	"""Send the rule's mail to every matching student not mailed this month. Returns the count."""
	today = getdate(today)
	month_start = get_first_day(today)
	already = {
		(row.recipient, row.course)
		for row in frappe.get_all(
			"LMS Auto Mail Log",
			{"rule": rule.name, "sent_on": ["between", [month_start, get_last_day(today)]]},
			["recipient", "course"],
		)
	}

	sent = 0
	for student in get_matching_students(rule):
		if (student.member, student.course) in already:
			continue
		status = "Queued"
		try:
			mail = render_mail(rule, student)
			queued = frappe.sendmail(
				recipients=[student.member],
				subject=mail.get("subject"),
				content=mail.get("message"),
				header=[_("Progress Reminder"), "orange"],
				retry=3,
			)
			# Frappe returns nothing when it drops a mail (e.g. an invalid address).
			if queued:
				sent += 1
			else:
				status = "Failed"
		except Exception:
			status = "Failed"
			frappe.log_error(title=_("Auto mail failed for {0}").format(student.member))
		frappe.get_doc(
			{
				"doctype": "LMS Auto Mail Log",
				"rule": rule.name,
				"recipient": student.member,
				"course": student.course,
				"progress": student.progress,
				"sent_on": today,
				"status": status,
			}
		).insert(ignore_permissions=True)

	frappe.db.set_value(
		"LMS Auto Mail Rule", rule.name, {"last_run_on": today, "last_run_count": sent}, update_modified=False
	)
	return sent


def run_auto_mail_rules(now=None):
	"""Hourly job: run each enabled rule once, on its day of the month, after its send time."""
	if not has_outgoing_email():
		return

	now = now or now_datetime()
	today = getdate(now)
	rules = frappe.get_all(
		"LMS Auto Mail Rule",
		{"enabled": 1},
		["name", "course", "operator", "progress_percent", "day_of_month", "send_time", "email_template", "last_run_on"],
	)
	for rule in rules:
		if effective_day(rule.day_of_month, today) != today.day:
			continue
		if rule.last_run_on and getdate(rule.last_run_on) == today:
			continue
		if rule.send_time and now.time() < get_time(rule.send_time):
			continue
		try:
			run_rule(rule, today)
			frappe.db.commit()
		except Exception:
			frappe.db.rollback()
			frappe.log_error(title=_("Auto mail rule {0} failed").format(rule.name))
