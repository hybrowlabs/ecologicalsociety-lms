import frappe

from lms.lms.api import get_member_lesson_progress, set_member_lesson_progress
from lms.lms.test_helpers import BaseTestUtils


class TestMemberLessonProgress(BaseTestUtils):
	def setUp(self):
		super().setUp()
		self.moderator = self._create_user("mlp.moderator@example.com", "Mod", "Erator", ["Moderator"])
		self.student = self._create_user("mlp.student@example.com", "Late", "Joiner", ["LMS Student"])
		self.course, self.lessons = self._create_course_with_lessons("Late Joiner Course", 3)
		self.other_course, self.other_lessons = self._create_course_with_lessons("Late Joiner Other", 1)
		self._create_enrollment(self.student.name, self.course.name)

	def tearDown(self):
		frappe.set_user("Administrator")
		for name in frappe.get_all("LMS Course Progress", {"member": self.student.name}, pluck="name"):
			frappe.delete_doc("LMS Course Progress", name, force=True)
		super().tearDown()

	def _create_course_with_lessons(self, title, count):
		course = self._create_course(title, instructor=self.moderator.name)
		chapter = self._create_chapter(f"{title} Chapter", course.name)
		course.reload()
		if not any(c.chapter == chapter.name for c in course.chapters):
			course.append("chapters", {"chapter": chapter.name})
			course.save()

		chapter.reload()
		lessons = []
		for i in range(1, count + 1):
			lesson = self._create_lesson(f"{title} Lesson {i}", chapter.name, course.name)
			if not any(l.lesson == lesson.name for l in chapter.lessons):
				chapter.append("lessons", {"lesson": lesson.name})
			lessons.append(lesson.name)
		chapter.save()
		return course, lessons

	def _progress(self):
		return frappe.db.get_value(
			"LMS Enrollment", {"course": self.course.name, "member": self.student.name}, "progress"
		)

	def _completed(self):
		return set(
			frappe.get_all(
				"LMS Course Progress",
				{"member": self.student.name, "course": self.course.name, "status": "Complete"},
				pluck="lesson",
			)
		)

	def test_moderator_marks_lessons_complete(self):
		frappe.set_user(self.moderator.name)
		set_member_lesson_progress(self.course.name, self.student.name, self.lessons[:2], True)

		self.assertEqual(self._completed(), set(self.lessons[:2]))
		self.assertAlmostEqual(self._progress(), 66.67, places=1)

		statuses = {
			row.lesson: row.status for row in get_member_lesson_progress(self.course.name, self.student.name)
		}
		self.assertEqual(statuses[self.lessons[0]], "Complete")
		self.assertEqual(statuses[self.lessons[2]], "Pending")

	def test_marking_again_creates_no_duplicates(self):
		frappe.set_user(self.moderator.name)
		set_member_lesson_progress(self.course.name, self.student.name, self.lessons[:2], True)
		set_member_lesson_progress(self.course.name, self.student.name, self.lessons[:2], True)

		count = frappe.db.count("LMS Course Progress", {"member": self.student.name, "course": self.course.name})
		self.assertEqual(count, 2)

	def test_unmark_clears_progress(self):
		frappe.set_user(self.moderator.name)
		set_member_lesson_progress(self.course.name, self.student.name, self.lessons, True)
		self.assertEqual(self._progress(), 100)

		set_member_lesson_progress(self.course.name, self.student.name, [self.lessons[0]], False)
		self.assertEqual(self._completed(), set(self.lessons[1:]))
		self.assertAlmostEqual(self._progress(), 66.67, places=1)

	def test_student_cannot_mark_progress(self):
		frappe.set_user(self.student.name)
		with self.assertRaises(frappe.PermissionError):
			set_member_lesson_progress(self.course.name, self.student.name, self.lessons, True)

	def test_lesson_from_other_course_is_rejected(self):
		frappe.set_user(self.moderator.name)
		with self.assertRaises(frappe.ValidationError):
			set_member_lesson_progress(self.course.name, self.student.name, self.other_lessons, True)
		self.assertEqual(self._completed(), set())

	def test_requires_enrollment(self):
		frappe.set_user(self.moderator.name)
		with self.assertRaises(frappe.ValidationError):
			set_member_lesson_progress(self.other_course.name, self.student.name, self.other_lessons, True)
