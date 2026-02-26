import { createAuditLog } from "../repository/audit.repo";
import { CreateAuditLogInput } from "../types/audit.types"; // ✅ غيّر الاسم هنا

export class AuditService {
  static async log(input: CreateAuditLogInput): Promise<void> {
    await createAuditLog(input);
  }
}