import { Routes } from "@angular/router"
import { HomeComponent } from "./user/home/home.component"
import { EventsComponent } from "./user/events/events.component"
import { ErrorComponent } from "./user/error/error.component"
import { DashboardComponent } from "./admin/dashboard/dashboard.component"
import { FileExplorerComponent } from "./admin/file-explorer/file-explorer.component"
import { authGuard } from "../guards/auth.guard"
import { HeroEditorComponent } from "./admin/hero-editor/hero-editor.component"
import { EventEditorComponent } from "./admin/event-editor/event-editor.component"

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
    redirectTo: "/admin/login",
    pathMatch: "full"
  },
  {
    path: "admin",
    children: [
      {
        path: "dashboard",
        component: DashboardComponent
      },
      {
        path: "fileExplorer",
        component: FileExplorerComponent
      },
      {
        path: "heroEditor",
        component: HeroEditorComponent
      },
      {
        path: "eventEditor",
        component: EventEditorComponent
      }
    ],
    canActivate: [ authGuard ]
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
