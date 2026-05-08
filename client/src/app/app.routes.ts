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
        path: "galleryEditor",
        loadComponent: ( ) =>
          import ( "./admin/gallery-editor/gallery-editor.component" )
            .then ( m => m.GalleryEditorComponent )
      },
      {
        path: "eventEditor",
        loadComponent: ( ) =>
          import ( "./admin/event-editor/event-editor.component" )
            .then ( m => m.EventEditorComponent )
      },
      {
        path: "contactEditor",
        loadComponent: ( ) =>
          import ( "./admin/contact-editor/contact-editor.component" )
            .then ( m => m.ContactEditorComponent )
      },
      {
        path: "storyEditor",
        loadComponent: ( ) =>
          import ( "./admin/story-editor/story-editor.component" )
            .then ( m => m.StoryEditorComponent )
      },
      {
        path: "homeEditor",
        loadComponent: ( ) =>
          import ( "./admin/home-editor/home-editor.component" )
            .then ( m => m.HomeEditorComponent )
      },
      {
        path: "testimonialsEditor",
        loadComponent: ( ) =>
          import ( "./admin/testimonials-editor/testimonials-editor.component" )
            .then ( m => m.TestimonialsEditorComponent )
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
