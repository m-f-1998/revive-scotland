import { Routes } from "@angular/router"
import { HomeComponent } from "./user/home/home.component"
import { EventsComponent } from "./user/events/events.component"
import { ErrorComponent } from "./user/error/error.component"
import { GalleryComponent } from "./user/gallery/gallery.component"
import { authGuard } from "../guards/auth.guard"

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
    path: "gallery",
    component: GalleryComponent
  },
  {
    path: "admin",
    redirectTo: "/admin/login",
    pathMatch: "full"
  },
  {
    path: "admin",
    canActivate: [ authGuard ],
    children: [
      {
        path: "dashboard",
        loadComponent: ( ) =>
          import ( "./admin/dashboard/dashboard.component" )
            .then ( m => m.DashboardComponent )
      },
      {
        path: "fileExplorer",
        loadComponent: ( ) =>
          import ( "./admin/file-explorer/file-explorer.component" )
            .then ( m => m.FileExplorerComponent )
      },
      {
        path: "heroEditor",
        loadComponent: ( ) =>
          import ( "./admin/hero-editor/hero-editor.component" )
            .then ( m => m.HeroEditorComponent )
      },
      {
        path: "eventEditor",
        loadComponent: ( ) =>
          import ( "./admin/event-editor/event-editor.component" )
            .then ( m => m.EventEditorComponent )
      }
    ]
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
