import { EmailService, StaffNotifyPayload } from "./email.service.js"

/** @deprecated Use EmailService directly — kept for existing call sites. */
export type { StaffNotifyPayload }

/**
 * Staff notifications via email (Resend).
 */
export class StaffNotifyService {
  public static async notify ( payload: StaffNotifyPayload ): Promise<void> {
    await EmailService.notifyStaff ( payload )
  }
}
