import { Routes } from "@angular/router"
import { authGuard } from "../guards/auth.guard"
import { provideCharts, withDefaultRegisterables } from "ng2-charts"

export const routes: Routes = [
  {
    path: "",
    loadComponent: ( ) =>
      import ( "./user/home/home.component" ).then ( m => m.HomeComponent )
  },
  {
    path: "events",
    loadComponent: ( ) =>
      import ( "./user/events/events.component" ).then ( m => m.EventsComponent )
  },
  {
    path: "gallery",
    loadComponent: ( ) =>
      import ( "./user/gallery/gallery.component" ).then ( m => m.GalleryComponent )
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
        path: "resourcesEditor",
        loadComponent: ( ) =>
          import ( "./admin/resources-editor/resources-editor.component" )
            .then ( m => m.ResourcesEditorComponent )
      },
      {
        path: "dashboard",
        providers: [ provideCharts ( withDefaultRegisterables ( ) ) ],
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
    path: "resources",
    loadComponent: ( ) =>
      import ( "./user/resources/resources.component" ).then ( m => m.ResourcesComponent )
  },
  {
    path: "donate/thank-you",
    loadComponent: ( ) =>
      import ( "./user/donate-thankyou/donate-thankyou.component" ).then ( m => m.DonateThankyouComponent )
  },
  {
    path: "error",
    loadComponent: ( ) =>
      import ( "./user/error/error.component" ).then ( m => m.ErrorComponent )
  },
  {
    path: "error/:code",
    loadComponent: ( ) =>
      import ( "./user/error/error.component" ).then ( m => m.ErrorComponent )
  },
  {
    path: "**",
    redirectTo: "/error/404"
  }
]

