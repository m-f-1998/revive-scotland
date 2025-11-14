// src/app/auth.guard.ts
import { inject } from "@angular/core"
import { CanActivateFn, Router } from "@angular/router"
import { AuthService } from "../app/services/auth.service"

export const authGuard: CanActivateFn = async ( ) => {
  const authService = inject ( AuthService )
  const router = inject ( Router )

  if ( authService.loading ( ) ) {
    let attempts = 0
    const maxAttempts = 50
    const interval = 100

    while ( authService.loading ( ) && attempts < maxAttempts ) {
      await new Promise ( resolve => setTimeout ( resolve, interval ) )
      attempts++
    }
  }

  const user = authService.currentUser ( )

  if ( user ) {
    return true
  }

  return router.createUrlTree ( [ "/" ] )
}