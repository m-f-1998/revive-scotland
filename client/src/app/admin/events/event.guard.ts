import { inject } from "@angular/core"
import { ApplicationService } from "@services/application.service"
import { CanActivateChildFn, CanActivateFn, Router } from "@angular/router"

export const LoginActivate: CanActivateFn = ( ) => {
  const appSvc: ApplicationService = inject ( ApplicationService )
  const router: Router = inject ( Router )

  if ( appSvc.isLoggedIn ( ) ) return true

  return router.parseUrl ( "/login" )
}

export const LoginChildActivate: CanActivateChildFn = ( ) => {
  const appSvc: ApplicationService = inject ( ApplicationService )
  const router: Router = inject ( Router )

  if ( appSvc.isLoggedIn ( ) ) return true

  return router.parseUrl ( "/login" )
}