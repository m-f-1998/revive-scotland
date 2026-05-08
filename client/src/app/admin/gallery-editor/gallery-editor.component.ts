import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { Router } from "@angular/router"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { ApiService } from "../../services/api.service"
import { TitleCasePipe } from "@angular/common"

interface GalleryAlbum {
  name: string
  images: string [ ]
}

@Component ( {
  selector: "app-admin-gallery-editor",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, TitleCasePipe ],
  templateUrl: "./gallery-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class GalleryEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public albums: WritableSignal<GalleryAlbum [ ]> = signal ( [ ] )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly router: Router = inject ( Router )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/gallery" ).then ( data => {
      const galleries = data as Record<string, string [ ]>
      this.albums.set ( Object.entries ( galleries ).map ( ( [ name, images ] ) => ( { name, images } ) ) )
    } ).catch ( ( ) => {
      this.albums.set ( [ ] )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public previewUrl ( path: string ): string {
    if ( path.startsWith ( "http" ) || path.startsWith ( "/" ) ) return path
    return `/api/img/${path}?w=400&f=webp`
  }

  public goToFileExplorer ( ): void {
    this.router.navigate ( [ "/admin/fileExplorer" ] )
  }
}
