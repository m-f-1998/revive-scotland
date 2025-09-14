import { Routes } from "@angular/router"
import { HomeComponent } from "./user/home/home.component"
import { EventsComponent } from "./user/events/events.component"
import { ErrorComponent } from "./user/error/error.component"
import { LoginComponent } from "./admin/login/login.component"
import { AdminEventsComponent } from "./admin/events/events.component"
import { LoginActivate, LoginChildActivate } from "./admin/events/event.guard"

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
    path: "admin/events",
    component: AdminEventsComponent,
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
