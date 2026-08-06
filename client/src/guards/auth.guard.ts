// src/app/auth.guard.ts
import { inject } from "@angular/core"
import { CanActivateFn, Router } from "@angular/router"
import { HttpHeaders } from "@angular/common/http"
import { AuthService } from "../app/services/auth.service"
import { ApiService } from "../app/services/api.service"

export const authGuard: CanActivateFn = async ( ) => {
  const authService = inject ( AuthService )
  const apiSvc = inject ( ApiService )
  const router = inject ( Router )

  await authService.whenReady ( )

  const user = authService.currentUser ( )
  if ( !user ) {
    return router.createUrlTree ( [ "/" ] )
  }

  try {
    const token = await user.getIdToken ( )
    const res = await apiSvc.get (
      "/api/admin/isAdmin",
      { },
      new HttpHeaders ( { "Authorization": `Bearer ${token}` } )
    ) as { isAdmin?: boolean }

    if ( res?.isAdmin ) {
      return true
    }
  } catch {
    // fall through to deny
  }

  return router.createUrlTree ( [ "/" ] )
}
