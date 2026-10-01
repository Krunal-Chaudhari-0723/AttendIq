import mongoose from "mongoose";
import {
  AttendanceRecord,
  AttendanceSession,
  Class,
  EngagementScore,
  FaceProfile,
  Notification,
  Recommendation,
  RiskAssessment,
  Student,
  VerificationAttempt,
} from "../models";

/**
 * Idempotent data migrations that run on every startup.
 */
export const runMigrations = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 1) return;

  // Phase 5: earlier seeds stored synthetic (non-biometric) "embeddings" in plain arrays.
  // They can never match a real face, so remove them and require genuine enrollment.
  const legacyProfiles = await FaceProfile.find({ embeddingEncrypted: { $exists: false } }).select("studentId");
  if (legacyProfiles.length > 0) {
    const ids = legacyProfiles.map((p) => p.studentId);
    await FaceProfile.deleteMany({ _id: { $in: legacyProfiles.map((p) => p._id) } });
    await Student.updateMany({ studentId: { $in: ids } }, { $set: { isFaceEnrolled: false }, $unset: { faceProfileId: 1 } });
    console.log(`[Migration] Removed ${ids.length} synthetic face profile(s); students must enroll with a live camera.`);
  }

  // Phase 8: earlier seeds inserted hand-written engagement/risk/recommendation documents.
  // Derived analytics must come from the engines, so drop anything not produced by them.
  const fakeEngagement = await EngagementScore.deleteMany({ engineVersion: { $exists: false } });
  const fakeRisk = await RiskAssessment.deleteMany({ engineVersion: { $exists: false } });
  const fakeRecs = await Recommendation.deleteMany({ engineVersion: { $exists: false } });
  const removed = fakeEngagement.deletedCount + fakeRisk.deletedCount + fakeRecs.deletedCount;
  if (removed > 0) console.log(`[Migration] Removed ${removed} hand-written analytics document(s); they will be recomputed.`);

  // Old seeded notifications described events that never happened
  await Notification.deleteMany({
    title: {
      $in: ["Class Attendance Window Open", "Live Session Started", "Campus Location Verification Active", "At-Risk Alert: Rahul Verma"],
    },
    "metadata.generated": { $ne: true },
  });

  // Old seeded attendance claimed face/location verification that never took place
  await AttendanceRecord.updateMany(
    { verificationMethod: { $in: ["FACE_AND_LOCATION", "REMOTE_FACE"] }, "verificationMetadata.attemptId": { $exists: false } },
    {
      $set: {
        verificationMethod: "MANUAL",
        confidence: 0,
        livenessVerified: false,
        locationVerified: false,
        "verificationMetadata.note": "Seeded demo record (not biometrically verified)",
      },
    }
  );

  // Earlier seeds created "live" sessions at fixed times with fake dynamic codes; once auto-finalized
  // they marked every student absent. They never happened, so remove them and their records.
  const fakeSessions = await AttendanceSession.find({ dynamicCode: { $in: ["749201", "518392"] } }).select("_id");
  if (fakeSessions.length) {
    const ids = fakeSessions.map((x) => x._id);
    await AttendanceRecord.deleteMany({ sessionId: { $in: ids } });
    await VerificationAttempt.deleteMany({ sessionId: { $in: ids } });
    await AttendanceSession.deleteMany({ _id: { $in: ids } });
    console.log(`[Migration] Removed ${ids.length} placeholder session(s) from the old seed.`);
  }

  // Class.studentCount is denormalised: keep it equal to the real number of active students
  for (const cls of await Class.find().select("_id studentCount")) {
    const count = await Student.countDocuments({ classId: cls._id, status: "ACTIVE" });
    if (cls.studentCount !== count) await Class.updateOne({ _id: cls._id }, { $set: { studentCount: count } });
  }

  // Keep Student.isFaceEnrolled consistent with real FaceProfile documents
  const enrolledIds = (await FaceProfile.find({ isActive: true }).select("studentId")).map((p) => p.studentId);
  await Student.updateMany(
    { isFaceEnrolled: true, studentId: { $nin: enrolledIds } },
    { $set: { isFaceEnrolled: false }, $unset: { faceProfileId: 1 } }
  );
};
