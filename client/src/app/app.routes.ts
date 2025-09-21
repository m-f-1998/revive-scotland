import { Routes } from "@angular/router"
import { HomeComponent } from "./user/home/home.component"
import { EventsComponent } from "./user/events/events.component"
import { ErrorComponent } from "./user/error/error.component"
import { LoginComponent } from "./admin/login/login.component"
import { HomeComponent as AdminHomeComponent } from "./admin/home/home.component"
import { AdminEventsComponent } from "./admin/events/events.component"
import { LoginActivate, LoginChildActivate } from "./guards/login.guard"
import { HeadersComponent } from "./admin/headers/headers.component"
import { UploadComponent } from "./admin/upload/upload.component"

export const routes: Routes = [
  {
    path: "",
    component: HomeComponent
  },
  {
    path: "events",
    component: EventsComponent
  },
  {
    path: "login",
    component: LoginComponent
  },
  {
    path: "admin/home",
    component: AdminHomeComponent,
    canActivate: [ LoginActivate ],
    canActivateChild: [ LoginChildActivate ]
  },
  {
    path: "admin/events",
    component: AdminEventsComponent,
    canActivate: [ LoginActivate ],
    canActivateChild: [ LoginChildActivate ]
  },
  {
    path: "admin/headers",
    component: HeadersComponent,
    canActivate: [ LoginActivate ],
    canActivateChild: [ LoginChildActivate ]
  },
  {
    path: "admin/upload",
    component: UploadComponent,
    canActivate: [ LoginActivate ],
    canActivateChild: [ LoginChildActivate ]
  },
  {
    path: "error",
    component: ErrorComponent
  },
  {
    path: "error/:code",
    component: ErrorComponent
  },
  {
    path: "**",
    redirectTo: "/error/404"
  }
]
