import { Routes } from "@angular/router"
import { HomeComponent } from "./user/home/home.component"
import { EventsComponent } from "./user/events/events.component"
import { PaymentCompleteComponent } from "./user/payment-complete/payment-complete.component"
import { AdminLoginComponent } from "./admin/login/login.component"
import { AuthActive } from "./guards/Auth.guard"
import { AdminDashboardComponent } from "./admin/dashboard/dashboard.component"
import { CancelledEventComponent } from "./user/cancelled-event/cancelled-event.component"

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
    path: "admin",
    redirectTo: "admin/login",
  },
  {
    path: "admin/login",
    component: AdminLoginComponent
  },
  {
    path: "admin/dashboard",
    component: AdminDashboardComponent,
    canActivate: [ AuthActive ],
  },
  {
    path: "payment-complete",
    component: PaymentCompleteComponent
  },
  {
    path: "cancellation",
    component: CancelledEventComponent
  }
]
