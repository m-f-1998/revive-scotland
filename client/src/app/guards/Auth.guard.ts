import { CanActivateChildFn, CanActivateFn, Router } from "@angular/router"
import { AdminService } from "@services/AdminService.service"
import { inject } from "@angular/core"

export const AuthActive: CanActivateFn = ( ) => {
  const app: AdminService = inject ( AdminService )
  const router: Router = inject ( Router )

  if ( app.loggedIn ( ) ) return true

  return router.parseUrl ( "/admin/login" )
}

export const AuthChildActive: CanActivateChildFn = ( ) => {
  const app: AdminService = inject ( AdminService )
  const router: Router = inject ( Router )

  if ( app.loggedIn ( ) ) return true

  return router.parseUrl ( "/admin/login" )
}