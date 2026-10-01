import { User } from "../models/User";

export const seedDefaultUsers = async () => {
  try {
    const defaultAccounts = [
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
    ];

    for (const acc of defaultAccounts) {
      const exists = await User.findOne({ email: acc.email });
      if (!exists) {
        await User.create(acc);
        console.log(`[Seed] Created default ${acc.role} account: ${acc.email}`);
      }
    }
  } catch (error) {
    console.warn(`[Seed] Note: Could not auto-seed users (DB might be offline):`, (error as Error).message);
  }
};
