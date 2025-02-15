import { Routes } from "@angular/router"
import { HomeComponent } from "./user/home/home.component"
import { EventsComponent } from "./user/events/events.component"
import { ErrorComponent } from "./user/error/error.component"

export const routes: Routes = [
  {
    path: "",
    component: HomeComponent
  },
  {
    path: "events",
    component: EventsComponent
  },
  { path: "error", component: ErrorComponent },
  { path: "error/:code", component: ErrorComponent },
  { path: "**", redirectTo: "/error/404" }
]
