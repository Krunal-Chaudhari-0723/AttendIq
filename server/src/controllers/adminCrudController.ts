import { Response } from "express";
import mongoose from "mongoose";
import { AcademicYear, Class, Student, Subject, Teacher, User } from "../models";
import { sendResponse } from "../utils/apiResponse";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Admin CRUD for students, teachers, classes, subjects and academic years.
 * Every write uses an explicit field whitelist (no mass assignment) and validated input.
 */

type Body = Record<string, unknown>;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,18}$/;
const ID_RE = /^[A-Z0-9-]{2,20}$/;

const isId = (v: unknown): v is string => typeof v === "string" && mongoose.Types.ObjectId.isValid(v);
const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/** Escape user text before using it in a MongoDB $regex (prevents regex injection / ReDoS). */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const searchFilter = (search: unknown, fields: string[]) => {
  const q = str(search, 60);
  if (!q) return {};
  const rx = { $regex: escapeRegex(q), $options: "i" };
  return { $or: fields.map((f) => ({ [f]: rx })) };
};
const strongPassword = (p: unknown) => typeof p === "string" && p.length >= 8 && p.length <= 128 && /[A-Za-z]/.test(p) && /[0-9]/.test(p);
const bad = (res: Response, error: string, statusCode = 400) => sendResponse({ res, statusCode, error });
const byIdOrCode = (id: string, codeField: string) => (mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { [codeField]: id.toUpperCase() });

// =====================================================================
// STUDENTS
// =====================================================================

export const getStudents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, classId, status, isFaceEnrolled } = req.query;
    const filter: Record<string, unknown> = { ...searchFilter(search, ["name", "email", "studentId", "rollNumber"]) };
    if (classId) {
      if (!isId(classId)) return bad(res, "Invalid classId");
      filter.classId = classId;
    }
    if (status) {
      if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(String(status))) return bad(res, "Invalid status");
      filter.status = status;
    }
    if (isFaceEnrolled === "true" || isFaceEnrolled === "false") filter.isFaceEnrolled = isFaceEnrolled === "true";
    // Paginated: ?page=1&limit=200 (limit capped at 500)
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const [students, total] = await Promise.all([
      Student.find(filter).populate("classId", "name code division").sort({ studentId: 1 }).skip((page - 1) * limit).limit(limit),
      Student.countDocuments(filter),
    ]);
    return sendResponse({ res, data: { students, count: students.length, total, page, pages: Math.ceil(total / limit) } });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch students" });
  }
};

/** Resolve a class from classId (preferred) or an exact class name. */
const resolveClass = async (classId: unknown, className: unknown) => {
  if (isId(classId)) return Class.findOne({ _id: classId, isActive: true });
  const name = str(className);
  if (!name) return null;
  const matches = await Class.find({ name, isActive: true });
  return matches.length === 1 ? matches[0] : null;
};

export const createStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const b = (req.body ?? {}) as Body;
    const studentId = str(b.studentId, 20).toUpperCase();
    const name = str(b.name);
    const email = str(b.email).toLowerCase();
    const rollNumber = str(b.rollNumber, 40);
    if (!ID_RE.test(studentId)) return bad(res, "Student ID must be 2–20 letters, digits or dashes.");
    if (name.length < 2) return bad(res, "Name is required.");
    if (!EMAIL_RE.test(email)) return bad(res, "A valid email is required.");
    if (!rollNumber) return bad(res, "Roll number is required.");
    if (b.password && !strongPassword(b.password)) return bad(res, "Password must be at least 8 characters with letters and numbers.");
    const cls = await resolveClass(b.classId, b.className);
    if (!cls) return bad(res, "Select a valid, active class for the student.");

    const existing = await Student.findOne({ $or: [{ email }, { studentId }, { rollNumber }] });
    if (existing) return bad(res, "A student with this ID, email or roll number already exists.", 409);
    if (b.password && (await User.exists({ email }))) return bad(res, "A login account with this email already exists.", 409);

    const student = await Student.create({
      studentId,
      name,
      email,
      rollNumber,
      department: str(b.department) || cls.department,
      classId: cls._id,
      className: cls.name,
      academicYear: cls.academicYear,
      phone: PHONE_RE.test(str(b.phone, 20)) ? str(b.phone, 20) : undefined,
      status: "ACTIVE",
    });
    if (b.password) {
      await User.create({ name, email, password: b.password, role: "STUDENT", studentId });
    }
    return sendResponse({ res, statusCode: 201, message: "Student created successfully", data: student });
  } catch (error) {
    console.error("[Admin API] create student:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to create student" });
  }
};

export const updateStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await Student.findOne(byIdOrCode(req.params.id, "studentId"));
    if (!student) return bad(res, "Student not found", 404);
    const b = (req.body ?? {}) as Body;
    const updates: Record<string, unknown> = {};

    if (b.name !== undefined) {
      if (str(b.name).length < 2) return bad(res, "Name is too short.");
      updates.name = str(b.name);
    }
    if (b.email !== undefined) {
      const email = str(b.email).toLowerCase();
      if (!EMAIL_RE.test(email)) return bad(res, "Invalid email.");
      if (email !== student.email && (await Student.exists({ email }))) return bad(res, "Email already in use.", 409);
      updates.email = email;
    }
    if (b.rollNumber !== undefined) updates.rollNumber = str(b.rollNumber, 40);
    if (b.department !== undefined) updates.department = str(b.department);
    if (b.phone !== undefined) {
      const phone = str(b.phone, 20);
      if (phone && !PHONE_RE.test(phone)) return bad(res, "Invalid phone number.");
      updates.phone = phone || undefined;
    }
    if (b.classId !== undefined || b.className !== undefined) {
      const cls = await resolveClass(b.classId, b.className);
      if (!cls) return bad(res, "Select a valid, active class.");
      Object.assign(updates, { classId: cls._id, className: cls.name, academicYear: cls.academicYear });
    }
    if (b.status !== undefined) {
      if (!["ACTIVE", "INACTIVE", "SUSPENDED"].includes(String(b.status))) return bad(res, "Invalid status.");
      updates.status = b.status;
    }
    if (Object.keys(updates).length === 0) return bad(res, "No editable fields were provided.");

    const updated = await Student.findByIdAndUpdate(student._id, { $set: updates }, { new: true, runValidators: true });
    // Keep the login account in sync (name/email, and disabled when not ACTIVE)
    const userSync: Record<string, unknown> = {};
    if (updates.name) userSync.name = updates.name;
    if (updates.email) userSync.email = updates.email;
    if (updates.status) userSync.isActive = updates.status === "ACTIVE";
    if (Object.keys(userSync).length) await User.updateOne({ studentId: student.studentId }, { $set: userSync });
    return sendResponse({ res, message: "Student updated successfully", data: updated });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to update student" });
  }
};

export const deleteStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = await Student.findOneAndUpdate(byIdOrCode(req.params.id, "studentId"), { $set: { status: "INACTIVE" } }, { new: true });
    if (!student) return bad(res, "Student not found", 404);
    await User.updateOne({ studentId: student.studentId }, { $set: { isActive: false } });
    return sendResponse({ res, message: "Student deactivated and login disabled", data: student });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to deactivate student" });
  }
};

// =====================================================================
// TEACHERS
// =====================================================================

export const getTeachers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, department, status } = req.query;
    const filter: Record<string, unknown> = { ...searchFilter(search, ["name", "email", "teacherId"]) };
    if (department) filter.department = str(department);
    if (status) {
      if (!["ACTIVE", "ON_LEAVE", "INACTIVE"].includes(String(status))) return bad(res, "Invalid status");
      filter.status = status;
    }
    const teachers = await Teacher.find(filter)
      .populate("assignedClasses", "name code division")
      .populate("subjectsTaught", "name code credits")
      .sort({ teacherId: 1 });
    return sendResponse({ res, data: { teachers, count: teachers.length } });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch teachers" });
  }
};

export const getTeacherById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await Teacher.findOne(byIdOrCode(req.params.id, "teacherId")).populate("assignedClasses").populate("subjectsTaught");
    if (!teacher) return bad(res, "Teacher not found", 404);
    return sendResponse({ res, data: teacher });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch teacher" });
  }
};

export const createTeacher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const b = (req.body ?? {}) as Body;
    const teacherId = str(b.teacherId, 20).toUpperCase();
    const name = str(b.name);
    const email = str(b.email).toLowerCase();
    if (!ID_RE.test(teacherId)) return bad(res, "Teacher ID must be 2–20 letters, digits or dashes.");
    if (name.length < 2) return bad(res, "Name is required.");
    if (!EMAIL_RE.test(email)) return bad(res, "A valid email is required.");
    if (b.phone && !PHONE_RE.test(str(b.phone, 20))) return bad(res, "Invalid phone number.");
    if (b.password && !strongPassword(b.password)) return bad(res, "Password must be at least 8 characters with letters and numbers.");
    if (await Teacher.exists({ $or: [{ email }, { teacherId }] })) return bad(res, "A teacher with this ID or email already exists.", 409);
    if (b.password && (await User.exists({ email }))) return bad(res, "A login account with this email already exists.", 409);

    const teacher = await Teacher.create({
      teacherId,
      name,
      email,
      department: str(b.department) || "Computer Science & Applications",
      designation: str(b.designation) || "Assistant Professor",
      phone: str(b.phone, 20) || undefined,
      status: "ACTIVE",
    });
    if (b.password) await User.create({ name, email, password: b.password, role: "TEACHER", teacherId });
    return sendResponse({ res, statusCode: 201, message: "Teacher created successfully", data: teacher });
  } catch (error) {
    console.error("[Admin API] create teacher:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to create teacher" });
  }
};

export const updateTeacher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await Teacher.findOne(byIdOrCode(req.params.id, "teacherId"));
    if (!teacher) return bad(res, "Teacher not found", 404);
    const b = (req.body ?? {}) as Body;
    const updates: Record<string, unknown> = {};
    if (b.name !== undefined) {
      if (str(b.name).length < 2) return bad(res, "Name is too short.");
      updates.name = str(b.name);
    }
    if (b.email !== undefined) {
      const email = str(b.email).toLowerCase();
      if (!EMAIL_RE.test(email)) return bad(res, "Invalid email.");
      if (email !== teacher.email && (await Teacher.exists({ email }))) return bad(res, "Email already in use.", 409);
      updates.email = email;
    }
    if (b.department !== undefined) updates.department = str(b.department);
    if (b.designation !== undefined) updates.designation = str(b.designation);
    if (b.phone !== undefined) {
      const phone = str(b.phone, 20);
      if (phone && !PHONE_RE.test(phone)) return bad(res, "Invalid phone number.");
      updates.phone = phone || undefined;
    }
    if (b.status !== undefined) {
      if (!["ACTIVE", "ON_LEAVE", "INACTIVE"].includes(String(b.status))) return bad(res, "Invalid status.");
      updates.status = b.status;
    }
    if (b.assignedClasses !== undefined) {
      if (!Array.isArray(b.assignedClasses) || !b.assignedClasses.every(isId)) return bad(res, "assignedClasses must be a list of class ids.");
      const count = await Class.countDocuments({ _id: { $in: b.assignedClasses } });
      if (count !== b.assignedClasses.length) return bad(res, "One or more classes do not exist.");
      updates.assignedClasses = b.assignedClasses;
    }
    if (Object.keys(updates).length === 0) return bad(res, "No editable fields were provided.");

    const updated = await Teacher.findByIdAndUpdate(teacher._id, { $set: updates }, { new: true, runValidators: true });
    const userSync: Record<string, unknown> = {};
    if (updates.name) userSync.name = updates.name;
    if (updates.email) userSync.email = updates.email;
    if (updates.status) userSync.isActive = updates.status !== "INACTIVE";
    if (Object.keys(userSync).length) await User.updateOne({ teacherId: teacher.teacherId }, { $set: userSync });
    return sendResponse({ res, message: "Teacher updated successfully", data: updated });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to update teacher" });
  }
};

export const deleteTeacher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacher = await Teacher.findOneAndUpdate(byIdOrCode(req.params.id, "teacherId"), { $set: { status: "INACTIVE" } }, { new: true });
    if (!teacher) return bad(res, "Teacher not found", 404);
    await User.updateOne({ teacherId: teacher.teacherId }, { $set: { isActive: false } });
    return sendResponse({ res, message: "Teacher deactivated and login disabled", data: teacher });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to deactivate teacher" });
  }
};

// =====================================================================
// CLASSES
// =====================================================================

export const getClasses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter: Record<string, unknown> = { isActive: true, ...searchFilter(req.query.search, ["name", "code", "department"]) };
    if (req.query.academicYear) filter.academicYear = str(req.query.academicYear, 20);
    const classes = await Class.find(filter).populate("classTeacher", "name teacherId email").sort({ code: 1 });
    // Student counts come from real records, not a stored counter
    const counts = await Student.aggregate([
      { $match: { classId: { $in: classes.map((c) => c._id) }, status: "ACTIVE" } },
      { $group: { _id: "$classId", n: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n as number]));
    return sendResponse({
      res,
      data: { classes: classes.map((c) => ({ ...c.toObject(), studentCount: countMap.get(String(c._id)) ?? 0 })), count: classes.length },
    });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch classes" });
  }
};

export const getClassById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Class not found", 404);
    const cls = await Class.findById(req.params.id).populate("classTeacher", "name teacherId email");
    if (!cls) return bad(res, "Class not found", 404);
    const [students, subjects] = await Promise.all([
      Student.find({ classId: cls._id, status: "ACTIVE" }).select("studentId name email rollNumber isFaceEnrolled"),
      Subject.find({ classId: cls._id }).populate("teacherId", "name teacherId"),
    ]);
    return sendResponse({ res, data: { class: { ...cls.toObject(), studentCount: students.length }, students, subjects } });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch class details" });
  }
};

const classFields = async (b: Body, partial: boolean) => {
  const out: Record<string, unknown> = {};
  if (!partial || b.name !== undefined) {
    if (str(b.name).length < 2) return { error: "Class name is required." };
    out.name = str(b.name);
  }
  if (!partial || b.semester !== undefined) {
    const sem = Number(b.semester);
    if (!Number.isInteger(sem) || sem < 1 || sem > 10) return { error: "Semester must be a whole number from 1 to 10." };
    out.semester = sem;
  }
  if (b.division !== undefined) out.division = str(b.division, 5).toUpperCase() || "A";
  if (b.department !== undefined) out.department = str(b.department);
  if (b.academicYear !== undefined) {
    const year = str(b.academicYear, 20);
    if (!/^\d{4}-\d{4}$/.test(year)) return { error: "Academic year must look like 2025-2026." };
    out.academicYear = year;
  }
  if (b.classTeacher !== undefined && b.classTeacher !== "" && b.classTeacher !== null) {
    if (!isId(b.classTeacher) || !(await Teacher.exists({ _id: b.classTeacher }))) return { error: "Class teacher not found." };
    out.classTeacher = b.classTeacher;
  }
  return { out };
};

export const createClass = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const b = (req.body ?? {}) as Body;
    const code = str(b.code, 20).toUpperCase();
    if (!ID_RE.test(code)) return bad(res, "Class code must be 2–20 letters, digits or dashes.");
    const parsed = await classFields(b, false);
    if ("error" in parsed) return bad(res, parsed.error!);
    if (await Class.exists({ code })) return bad(res, "Class code already exists.", 409);
    const cls = await Class.create({
      ...parsed.out,
      code,
      division: parsed.out.division ?? "A",
      department: parsed.out.department || "Computer Science & Applications",
      academicYear: parsed.out.academicYear ?? "2025-2026",
      isActive: true,
    });
    return sendResponse({ res, statusCode: 201, message: "Class created successfully", data: cls });
  } catch (error) {
    console.error("[Admin API] create class:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to create class" });
  }
};

export const updateClass = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Class not found", 404);
    const parsed = await classFields((req.body ?? {}) as Body, true);
    if ("error" in parsed) return bad(res, parsed.error!);
    if (Object.keys(parsed.out).length === 0) return bad(res, "No editable fields were provided.");
    const cls = await Class.findByIdAndUpdate(req.params.id, { $set: parsed.out }, { new: true, runValidators: true });
    if (!cls) return bad(res, "Class not found", 404);
    // Students show the class name; keep it consistent
    if (parsed.out.name) await Student.updateMany({ classId: cls._id }, { $set: { className: cls.name } });
    return sendResponse({ res, message: "Class updated successfully", data: cls });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to update class" });
  }
};

export const deleteClass = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Class not found", 404);
    const active = await Student.countDocuments({ classId: req.params.id, status: "ACTIVE" });
    if (active > 0) return bad(res, `Move or deactivate the ${active} active student(s) in this class first.`, 409);
    const cls = await Class.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true });
    if (!cls) return bad(res, "Class not found", 404);
    return sendResponse({ res, message: "Class deactivated successfully" });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to delete class" });
  }
};

// =====================================================================
// SUBJECTS
// =====================================================================

export const getSubjects = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filter: Record<string, unknown> = { ...searchFilter(req.query.search, ["name", "code"]) };
    if (req.query.classId) {
      if (!isId(req.query.classId)) return bad(res, "Invalid classId");
      filter.classId = req.query.classId;
    }
    if (req.query.teacherId) {
      if (!isId(req.query.teacherId)) return bad(res, "Invalid teacherId");
      filter.teacherId = req.query.teacherId;
    }
    const subjects = await Subject.find(filter).populate("classId", "name code division").populate("teacherId", "name teacherId email").sort({ code: 1 });
    return sendResponse({ res, data: { subjects, count: subjects.length } });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch subjects" });
  }
};

const numberInRange = (v: unknown, min: number, max: number, fallback: number) => {
  if (v === undefined || v === "" || v === null) return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : NaN;
};

export const createSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const b = (req.body ?? {}) as Body;
    const name = str(b.name);
    const code = str(b.code, 20).toUpperCase();
    if (name.length < 2) return bad(res, "Subject name is required.");
    if (!ID_RE.test(code)) return bad(res, "Subject code must be 2–20 letters, digits or dashes.");
    if (!isId(b.classId)) return bad(res, "Select a class.");
    const cls = await Class.findById(b.classId);
    if (!cls) return bad(res, "Class not found.");
    let teacherId: mongoose.Types.ObjectId | undefined;
    if (b.teacherId) {
      if (!isId(b.teacherId)) return bad(res, "Invalid teacher.");
      const t = await Teacher.findById(b.teacherId);
      if (!t) return bad(res, "Teacher not found.");
      teacherId = t._id as mongoose.Types.ObjectId;
    }
    const credits = numberInRange(b.credits, 1, 10, 4);
    const totalHours = numberInRange(b.totalHours, 1, 500, 45);
    if (Number.isNaN(credits) || Number.isNaN(totalHours)) return bad(res, "Credits must be 1–10 and hours 1–500.");
    if (await Subject.exists({ code })) return bad(res, "Subject code already exists.", 409);

    const subject = await Subject.create({
      name,
      code,
      classId: cls._id,
      teacherId,
      department: str(b.department) || cls.department,
      credits,
      totalHours,
      semester: cls.semester,
    });
    if (teacherId) await Teacher.updateOne({ _id: teacherId }, { $addToSet: { subjectsTaught: subject._id } });
    return sendResponse({ res, statusCode: 201, message: "Subject created successfully", data: subject });
  } catch (error) {
    console.error("[Admin API] create subject:", error);
    return sendResponse({ res, statusCode: 500, error: "Failed to create subject" });
  }
};

export const updateSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Subject not found", 404);
    const subject = await Subject.findById(req.params.id);
    if (!subject) return bad(res, "Subject not found", 404);
    const b = (req.body ?? {}) as Body;
    const updates: Record<string, unknown> = {};
    if (b.name !== undefined) {
      if (str(b.name).length < 2) return bad(res, "Subject name is too short.");
      updates.name = str(b.name);
    }
    if (b.credits !== undefined) {
      const c = numberInRange(b.credits, 1, 10, 4);
      if (Number.isNaN(c)) return bad(res, "Credits must be 1–10.");
      updates.credits = c;
    }
    if (b.totalHours !== undefined) {
      const h = numberInRange(b.totalHours, 1, 500, 45);
      if (Number.isNaN(h)) return bad(res, "Hours must be 1–500.");
      updates.totalHours = h;
    }
    if (b.teacherId !== undefined) {
      if (b.teacherId === null || b.teacherId === "") updates.teacherId = undefined;
      else if (!isId(b.teacherId) || !(await Teacher.exists({ _id: b.teacherId }))) return bad(res, "Teacher not found.");
      else updates.teacherId = b.teacherId;
    }
    if (Object.keys(updates).length === 0) return bad(res, "No editable fields were provided.");
    const updated = await Subject.findByIdAndUpdate(subject._id, { $set: updates }, { new: true, runValidators: true });
    if (updates.teacherId !== undefined && String(updates.teacherId) !== String(subject.teacherId)) {
      await Teacher.updateMany({ subjectsTaught: subject._id }, { $pull: { subjectsTaught: subject._id } });
      if (updates.teacherId) await Teacher.updateOne({ _id: updates.teacherId }, { $addToSet: { subjectsTaught: subject._id } });
    }
    return sendResponse({ res, message: "Subject updated successfully", data: updated });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to update subject" });
  }
};

export const deleteSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Subject not found", 404);
    const { AttendanceSession } = await import("../models");
    if (await AttendanceSession.exists({ subjectId: req.params.id })) {
      return bad(res, "This subject has attendance history and cannot be deleted.", 409);
    }
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return bad(res, "Subject not found", 404);
    await Teacher.updateMany({ subjectsTaught: subject._id }, { $pull: { subjectsTaught: subject._id } });
    return sendResponse({ res, message: "Subject deleted successfully" });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to delete subject" });
  }
};

// =====================================================================
// ACADEMIC YEARS
// =====================================================================

export const getAcademicYears = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const years = await AcademicYear.find().sort({ startDate: -1 });
    return sendResponse({ res, data: { academicYears: years } });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to fetch academic years" });
  }
};

export const createAcademicYear = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const b = (req.body ?? {}) as Body;
    const name = str(b.name, 20);
    if (!/^\d{4}-\d{4}$/.test(name)) return bad(res, "Name must look like 2026-2027.");
    const start = new Date(String(b.startDate));
    const end = new Date(String(b.endDate));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return bad(res, "Valid start and end dates are required (end after start).");
    if (await AcademicYear.exists({ name })) return bad(res, "Academic year already exists.", 409);
    if (b.isActive === true) await AcademicYear.updateMany({}, { $set: { isActive: false } });
    const year = await AcademicYear.create({ name, startDate: start, endDate: end, isActive: b.isActive === true, description: str(b.description, 200) || undefined });
    return sendResponse({ res, statusCode: 201, message: "Academic year created", data: year });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to create academic year" });
  }
};

export const activateAcademicYear = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Academic year not found", 404);
    const exists = await AcademicYear.findById(req.params.id);
    if (!exists) return bad(res, "Academic year not found", 404);
    await AcademicYear.updateMany({}, { $set: { isActive: false } });
    const year = await AcademicYear.findByIdAndUpdate(req.params.id, { $set: { isActive: true } }, { new: true });
    return sendResponse({ res, message: `Academic year ${year!.name} is now active`, data: year });
  } catch {
    return sendResponse({ res, statusCode: 500, error: "Failed to set active academic year" });
  }
};
