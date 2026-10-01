import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db";
import { seedDemoHistory } from "./seedHistory";
import {
  User,
  Student,
  Teacher,
  Class,
  Subject,
  AttendanceSession,
  AttendanceRecord,
  QuizResult,
  Assignment,
  EngagementScore,
  RiskAssessment,
  Recommendation,
  Notification,
  CampusSettings,
  AcademicYear,
} from "../models";

export const seedAllData = async (): Promise<void> => {
  try {
    console.log("-------------------------------------------------------");
    console.log("🌱 [Seed] Starting AttendIQ Database Seeding (Phase 3)");
    console.log("-------------------------------------------------------");

    // 1. Seed Campus Settings (Singleton / Authorized Campus Bounds)
    let campus = await CampusSettings.findOne();
    if (!campus) {
      campus = await CampusSettings.create({
        campusName: "AttendIQ Central Campus",
        latitude: 23.0225, // Central coordinates
        longitude: 72.5714,
        radiusMeters: 250, // 250m radius
        isEnforced: true,
        allowedModes: ["PHYSICAL", "REMOTE"],
      });
      console.log(`[Seed] ✅ Campus Settings created: ${campus.campusName} (Radius: ${campus.radiusMeters}m)`);
    } else {
      console.log(`[Seed] ℹ️  Campus Settings already present: ${campus.campusName}`);
    }

    // 1b. Seed Academic Year
    let currentYear = await AcademicYear.findOne({ name: "2025-2026" });
    if (!currentYear) {
      currentYear = await AcademicYear.create({
        name: "2025-2026",
        startDate: new Date("2025-07-01"),
        endDate: new Date("2026-06-30"),
        isActive: true,
        description: "Academic Year 2025-2026 (Active)",
      });
      console.log(`[Seed] ✅ Created Academic Year: ${currentYear.name} (Active)`);
    }

    // 2. Seed Teachers
    const teachersData = [
      {
        teacherId: "T201",
        name: "Prof. Sharma",
        email: "sharma@attendiq.edu",
        department: "Computer Science & Applications",
        designation: "Associate Professor",
        status: "ACTIVE" as const,
        phone: "+91 98765 43210",
      },
      {
        teacherId: "T202",
        name: "Dr. Rajesh Patel",
        email: "patel@attendiq.edu",
        department: "Computer Science & Applications",
        designation: "Assistant Professor",
        status: "ACTIVE" as const,
        phone: "+91 98765 43211",
      },
    ];

    const teacherMap = new Map<string, mongoose.Types.ObjectId>();
    for (const t of teachersData) {
      let teacher = await Teacher.findOne({ teacherId: t.teacherId });
      if (!teacher) {
        teacher = await Teacher.create(t);
        console.log(`[Seed] ✅ Created Teacher: ${t.name} (${t.teacherId})`);
      }
      teacherMap.set(t.teacherId, teacher._id as mongoose.Types.ObjectId);
    }

    // 3. Seed Classes
    const classesData = [
      {
        name: "MCA Sem 2",
        code: "MCA-2",
        division: "A",
        department: "Computer Science & Applications",
        semester: 2,
        academicYear: "2025-2026",
        studentCount: 28,
        classTeacher: teacherMap.get("T201"),
      },
      {
        name: "BCA Sem 4",
        code: "BCA-4",
        division: "B",
        department: "Computer Science & Applications",
        semester: 4,
        academicYear: "2025-2026",
        studentCount: 32,
        classTeacher: teacherMap.get("T201"),
      },
      {
        name: "BCA Sem 2",
        code: "BCA-2",
        division: "A",
        department: "Computer Science & Applications",
        semester: 2,
        academicYear: "2025-2026",
        studentCount: 30,
        classTeacher: teacherMap.get("T202"),
      },
      {
        name: "MCA Sem 4",
        code: "MCA-4",
        division: "A",
        department: "Computer Science & Applications",
        semester: 4,
        academicYear: "2025-2026",
        studentCount: 34,
        classTeacher: teacherMap.get("T202"),
      },
    ];

    const classMap = new Map<string, mongoose.Types.ObjectId>();
    for (const c of classesData) {
      let cls = await Class.findOne({ code: c.code });
      if (!cls) {
        cls = await Class.create(c);
        console.log(`[Seed] ✅ Created Class: ${c.name} (${c.code})`);
      }
      classMap.set(c.code, cls._id as mongoose.Types.ObjectId);
    }

    // Update teacher assigned classes
    await Teacher.updateOne(
      { teacherId: "T201" },
      { $addToSet: { assignedClasses: [classMap.get("MCA-2"), classMap.get("BCA-4")] } }
    );
    await Teacher.updateOne(
      { teacherId: "T202" },
      { $addToSet: { assignedClasses: [classMap.get("BCA-2"), classMap.get("MCA-4")] } }
    );

    // 4. Seed Subjects
    const subjectsData = [
      {
        name: "Advanced Javascript",
        code: "MCA201",
        classId: classMap.get("MCA-2")!,
        teacherId: teacherMap.get("T201"),
        department: "Computer Science & Applications",
        credits: 4,
        totalHours: 45,
        semester: 2,
      },
      {
        name: "Software Engineering",
        code: "MCA202",
        classId: classMap.get("MCA-2")!,
        teacherId: teacherMap.get("T202"),
        department: "Computer Science & Applications",
        credits: 4,
        totalHours: 45,
        semester: 2,
      },
      {
        name: "Database Systems",
        code: "BCA401",
        classId: classMap.get("BCA-4")!,
        teacherId: teacherMap.get("T201"),
        department: "Computer Science & Applications",
        credits: 4,
        totalHours: 45,
        semester: 4,
      },
      {
        name: "Web Technologies",
        code: "BCA201",
        classId: classMap.get("BCA-2")!,
        teacherId: teacherMap.get("T202"),
        department: "Computer Science & Applications",
        credits: 3,
        totalHours: 40,
        semester: 2,
      },
    ];

    const subjectMap = new Map<string, mongoose.Types.ObjectId>();
    for (const s of subjectsData) {
      let subj = await Subject.findOne({ code: s.code });
      if (!subj) {
        subj = await Subject.create(s);
        console.log(`[Seed] ✅ Created Subject: ${s.name} (${s.code})`);
      }
      subjectMap.set(s.code, subj._id as mongoose.Types.ObjectId);
    }

    // 5. Seed Students
    const studentsData = [
      {
        studentId: "S101",
        name: "Anand Chaudhari",
        email: "anand.student@attendiq.edu",
        rollNumber: "MCA-2025-01",
        department: "Computer Science & Applications",
        classId: classMap.get("MCA-2"),
        className: "MCA Sem 2",
        academicYear: "2025-2026",
        isFaceEnrolled: false,
        status: "ACTIVE" as const,
      },
      {
        studentId: "S102",
        name: "Krunal Chaudhari",
        email: "krunal.student@attendiq.edu",
        rollNumber: "BCA-2024-02",
        department: "Computer Science & Applications",
        classId: classMap.get("BCA-4"),
        className: "BCA Sem 4",
        academicYear: "2025-2026",
        isFaceEnrolled: false,
        status: "ACTIVE" as const,
      },
      {
        studentId: "S103",
        name: "Rahul Verma",
        email: "rahul.student@attendiq.edu",
        rollNumber: "MCA-2025-03",
        department: "Computer Science & Applications",
        classId: classMap.get("MCA-2"),
        className: "MCA Sem 2",
        academicYear: "2025-2026",
        isFaceEnrolled: false,
        status: "ACTIVE" as const,
      },
      {
        studentId: "S104",
        name: "Ananya Sharma",
        email: "ananya.student@attendiq.edu",
        rollNumber: "BCA-2024-04",
        department: "Computer Science & Applications",
        classId: classMap.get("BCA-4"),
        className: "BCA Sem 4",
        academicYear: "2025-2026",
        isFaceEnrolled: false,
        status: "ACTIVE" as const,
      },
      {
        studentId: "S105",
        name: "Karan Singh",
        email: "karan.student@attendiq.edu",
        rollNumber: "BCA-2025-05",
        department: "Computer Science & Applications",
        classId: classMap.get("BCA-2"),
        className: "BCA Sem 2",
        academicYear: "2025-2026",
        isFaceEnrolled: false,
        status: "ACTIVE" as const,
      },
      {
        studentId: "S106",
        name: "Pooja Patel",
        email: "pooja.student@attendiq.edu",
        rollNumber: "MCA-2025-06",
        department: "Computer Science & Applications",
        classId: classMap.get("MCA-2"),
        className: "MCA Sem 2",
        academicYear: "2025-2026",
        isFaceEnrolled: false,
        status: "ACTIVE" as const,
      },
      {
        studentId: "S107",
        name: "Amit Desai",
        email: "amit.student@attendiq.edu",
        rollNumber: "BCA-2024-07",
        department: "Computer Science & Applications",
        classId: classMap.get("BCA-4"),
        className: "BCA Sem 4",
        academicYear: "2025-2026",
        isFaceEnrolled: false,
        status: "ACTIVE" as const,
      },
    ];

    const studentMap = new Map<string, mongoose.Types.ObjectId>();
    for (const st of studentsData) {
      let student = await Student.findOne({ studentId: st.studentId });
      if (!student) {
        student = await Student.create(st);
        console.log(`[Seed] ✅ Created Student: ${st.name} (${st.studentId})`);
      }
      studentMap.set(st.studentId, student._id as mongoose.Types.ObjectId);
    }

    // 6. Face profiles are NOT seeded: every student enrolls with a live camera (Phase 5).

    // 7. Seed Users (Auth Accounts with bcrypt hashed passwords)
    const usersData = [
      {
        name: "System Admin",
        email: "admin@attendiq.edu",
        password: "Admin@123456",
        role: "ADMIN" as const,
      },
      {
        name: "Prof. Sharma",
        email: "sharma@attendiq.edu",
        password: "Teacher@123456",
        role: "TEACHER" as const,
        teacherId: "T201",
      },
      {
        name: "Dr. Rajesh Patel",
        email: "patel@attendiq.edu",
        password: "Teacher@123456",
        role: "TEACHER" as const,
        teacherId: "T202",
      },
      {
        name: "Anand Chaudhari",
        email: "anand.student@attendiq.edu",
        password: "Student@123456",
        role: "STUDENT" as const,
        studentId: "S101",
      },
      {
        name: "Krunal Chaudhari",
        email: "krunal.student@attendiq.edu",
        password: "Student@123456",
        role: "STUDENT" as const,
        studentId: "S102",
      },
      {
        name: "Rahul Verma",
        email: "rahul.student@attendiq.edu",
        password: "Student@123456",
        role: "STUDENT" as const,
        studentId: "S103",
      },
      {
        name: "Ananya Sharma",
        email: "ananya.student@attendiq.edu",
        password: "Student@123456",
        role: "STUDENT" as const,
        studentId: "S104",
      },
      {
        name: "Karan Singh",
        email: "karan.student@attendiq.edu",
        password: "Student@123456",
        role: "STUDENT" as const,
        studentId: "S105",
      },
    ];

    for (const u of usersData) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        await User.create(u);
        console.log(`[Seed] ✅ Created User auth account: ${u.email} (${u.role})`);
      }
    }

    // 8-15. Academic history is raw demo data built by seedDemoHistory().
    // Engagement, risk, recommendations and notifications are never seeded: they are computed/generated.
    await seedDemoHistory();

    console.log("-------------------------------------------------------");
    console.log("🎉 [Seed] Successfully seeded all 14 Collections!");
    console.log("-------------------------------------------------------");
  } catch (error) {
    console.error("[Seed Error] Failed to complete database seeding:", error);
    throw error;
  }
};

// Direct script execution support
if (require.main === module) {
  connectDB()
    .then(async () => {
      await seedAllData();
      await mongoose.disconnect();
      console.log("[Seed] MongoDB connection closed cleanly.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Seed Runner] Fatal error:", err);
      process.exit(1);
    });
}
