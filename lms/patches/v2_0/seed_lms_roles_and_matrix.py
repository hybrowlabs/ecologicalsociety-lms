import frappe

ROLES = [
	{"role_name": "MasterAdmin", "sort_order": 1, "description": "Full rights across all courses and batches."},
	{
		"role_name": "Course Creator",
		"sort_order": 2,
		"description": "Creates and edits courses/batches, and administers/evaluates the specific courses and batches assigned to them.",
	},
	{
		"role_name": "Course Coordinator",
		"sort_order": 3,
		"description": "Coordinates and administers the specific courses and batches assigned to them.",
	},
	{
		"role_name": "Core Faculty",
		"sort_order": 4,
		"description": "Evaluates and teaches the specific courses/batches assigned to them.",
	},
	{
		"role_name": "Guest Faculty",
		"sort_order": 5,
		"description": "Evaluates and teaches the specific courses/batches assigned to them, on a limited/guest basis.",
	},
	{"role_name": "Student", "sort_order": 6, "description": "Standard LMS learner. Capabilities unchanged from before this role system."},
]

RIGHTS = [
	{"right_name": "Admin", "description": "Administer courses/batches: manage members, settings, and access."},
	{"right_name": "Creation and Testing", "description": "Create and edit courses/batches, quizzes, and assignments."},
	{"right_name": "Evaluation", "description": "Grade assignments/quizzes and mark certificate eligibility."},
	{"right_name": "Coordination", "description": "Coordinate batch/course logistics: members, announcements, scheduling."},
]

# role -> right -> (all_courses, all_batches, specific_course, specific_batch)
# Seeded literally from the source rights matrix, including its one internal
# inconsistency: the "Evaluation" category marks Course Creator as "no" at
# the category level, but the scope sub-rows mark Course Creator "yes" for
# Specific Course/Specific Batch. Per product decision, the sub-row (more
# granular) data is what gets seeded; an admin can correct it later in the
# Roles & Permissions UI.
MATRIX = {
	"MasterAdmin": {
		"Admin": (1, 1, 1, 1),
		"Creation and Testing": (1, 1, 1, 1),
		"Evaluation": (1, 1, 1, 1),
		"Coordination": (1, 1, 1, 1),
	},
	"Course Creator": {
		"Admin": (0, 0, 1, 1),
		"Creation and Testing": (0, 0, 1, 1),
		"Evaluation": (0, 0, 1, 1),
		"Coordination": (0, 0, 0, 0),
	},
	"Course Coordinator": {
		"Admin": (0, 0, 1, 1),
		"Creation and Testing": (0, 0, 0, 0),
		"Evaluation": (0, 0, 0, 0),
		"Coordination": (0, 0, 1, 1),
	},
	"Core Faculty": {
		"Admin": (0, 0, 0, 0),
		"Creation and Testing": (0, 0, 0, 0),
		"Evaluation": (0, 0, 1, 1),
		"Coordination": (0, 0, 0, 0),
	},
	"Guest Faculty": {
		"Admin": (0, 0, 0, 0),
		"Creation and Testing": (0, 0, 0, 0),
		"Evaluation": (0, 0, 1, 1),
		"Coordination": (0, 0, 0, 0),
	},
	"Student": {
		"Admin": (0, 0, 0, 0),
		"Creation and Testing": (0, 0, 0, 0),
		"Evaluation": (0, 0, 0, 0),
		"Coordination": (0, 0, 0, 0),
	},
}


def execute():
	seed_rights()
	seed_roles()
	seed_matrix()


def seed_rights():
	for right in RIGHTS:
		if not frappe.db.exists("LMS Right", right["right_name"]):
			frappe.get_doc({"doctype": "LMS Right", **right}).insert(ignore_permissions=True)


def seed_roles():
	for role in ROLES:
		frappe_role_name = ensure_shadow_frappe_role(role["role_name"])

		if frappe.db.exists("LMS Role", role["role_name"]):
			doc = frappe.get_doc("LMS Role", role["role_name"])
		else:
			doc = frappe.new_doc("LMS Role")
			doc.role_name = role["role_name"]

		doc.description = role["description"]
		doc.sort_order = role["sort_order"]
		doc.is_system_role = 1
		doc.linked_frappe_role = frappe_role_name
		doc.save(ignore_permissions=True)


def ensure_shadow_frappe_role(role_name):
	if not frappe.db.exists("Role", role_name):
		frappe.get_doc({"doctype": "Role", "role_name": role_name, "desk_access": 0}).insert(
			ignore_permissions=True
		)
	return role_name


def seed_matrix():
	for role_name, rights in MATRIX.items():
		for right_name, scopes in rights.items():
			all_courses, all_batches, specific_course, specific_batch = scopes
			existing = frappe.db.exists("LMS Role Right Matrix", {"role": role_name, "right": right_name})
			if existing:
				doc = frappe.get_doc("LMS Role Right Matrix", existing)
			else:
				doc = frappe.new_doc("LMS Role Right Matrix")
				doc.role = role_name
				doc.right = right_name

			doc.scope_all_courses = all_courses
			doc.scope_all_batches = all_batches
			doc.scope_specific_course = specific_course
			doc.scope_specific_batch = specific_batch
			doc.save(ignore_permissions=True)
