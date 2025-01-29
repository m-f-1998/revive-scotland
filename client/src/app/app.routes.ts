import { Routes } from "@angular/router"
import { HomeComponent } from "./user/home/home.component"
import { EventsComponent } from "./user/events/events.component"

export const routes: Routes = [
  {
    path: "",
    component: HomeComponent
  },
  {
    path: "events",
    component: EventsComponent
  }
]
