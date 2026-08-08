/** reCAPTCHA Enterprise action names — must match client `grecaptcha.execute` actions. */
export const RecaptchaAction = {
  contactSubmit: "contact_submit",
  eventRegister: "event_register",
  eventWaitlist: "event_waitlist"
} as const

export type RecaptchaActionName = ( typeof RecaptchaAction ) [ keyof typeof RecaptchaAction ]

export const isRecaptchaAction = ( value: string ): value is RecaptchaActionName => {
  return ( Object.values ( RecaptchaAction ) as string [ ] ).includes ( value )
}
