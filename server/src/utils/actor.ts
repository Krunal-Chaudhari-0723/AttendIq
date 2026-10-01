import { Student, IStudent, Teacher, ITeacher } from "../models";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

/**
 * Resolve the domain profile of the *authenticated* user.
 * Identity always comes from the verified JWT -> User record, never from the request body.
 */

export const getAuthenticatedStudent = async (req: AuthenticatedRequest): Promise<IStudent | null> => {
  if (req.user?.role !== "STUDENT") return null;
  if (req.user.studentId) {
    const byId = await Student.findOne({ studentId: req.user.studentId.toUpperCase() });
    if (byId) return byId;
  }
  return Student.findOne({ email: req.user.email.toLowerCase() });
};

export const getAuthenticatedTeacher = async (req: AuthenticatedRequest): Promise<ITeacher | null> => {
  if (req.user?.role !== "TEACHER") return null;
  if (req.user.teacherId) {
    const byId = await Teacher.findOne({ teacherId: req.user.teacherId.toUpperCase() });
    if (byId) return byId;
  }
  return Teacher.findOne({ email: req.user.email.toLowerCase() });
};
