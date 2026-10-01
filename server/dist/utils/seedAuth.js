"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultUsers = void 0;
const User_1 = require("../models/User");
const seedDefaultUsers = async () => {
    try {
        const defaultAccounts = [
            {
                name: "System Admin",
                email: "admin@attendiq.edu",
                password: "Admin@123456",
                role: "ADMIN",
            },
            {
                name: "Prof. Sharma",
                email: "sharma@attendiq.edu",
                password: "Teacher@123456",
                role: "TEACHER",
                teacherId: "T201",
            },
            {
                name: "Anand Chaudhari",
                email: "anand.student@attendiq.edu",
                password: "Student@123456",
                role: "STUDENT",
                studentId: "S101",
            },
            {
                name: "Krunal Chaudhari",
                email: "krunal.student@attendiq.edu",
                password: "Student@123456",
                role: "STUDENT",
                studentId: "S102",
            },
        ];
        for (const acc of defaultAccounts) {
            const exists = await User_1.User.findOne({ email: acc.email });
            if (!exists) {
                await User_1.User.create(acc);
                console.log(`[Seed] Created default ${acc.role} account: ${acc.email}`);
            }
        }
    }
    catch (error) {
        console.warn(`[Seed] Note: Could not auto-seed users (DB might be offline):`, error.message);
    }
};
exports.seedDefaultUsers = seedDefaultUsers;
