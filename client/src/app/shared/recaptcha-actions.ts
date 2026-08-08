/** Must match server `RecaptchaAction` values used in Enterprise assessments. */
export const RecaptchaAction = {
  contactSubmit: "contact_submit",
  eventRegister: "event_register",
  eventWaitlist: "event_waitlist"
} as const

export type RecaptchaActionName = ( typeof RecaptchaAction ) [ keyof typeof RecaptchaAction ]
