import { ChangeDetectionStrategy, Component, inject, isDevMode, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { ModalService } from "../../services/modal.service"
import { FileExplorerComponent } from "../file-explorer/file-explorer.component"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { TitleCasePipe } from "@angular/common"
import { HttpHeaders } from "@angular/common/http"

interface AlbumData {
  static: string [ ]
  additional: string [ ]
}

@Component ( {
  selector: "app-admin-gallery-editor",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, TitleCasePipe ],
  templateUrl: "./gallery-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class GalleryEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public saving: WritableSignal<boolean> = signal ( false )
  public albumNames: WritableSignal<string [ ]> = signal ( [ ] )
  public albumData: WritableSignal<Record<string, AlbumData>> = signal ( { } )
  public hiddenImages: WritableSignal<Set<string>> = signal ( new Set ( ) )
  public additionalImages: WritableSignal<Record<string, string [ ]>> = signal ( { } )
  public collapsedAlbums: WritableSignal<Record<string, boolean>> = signal ( { } )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.loadGallery ( )
  }

  public allImagesForAlbum ( name: string ): string [ ] {
    const data = this.albumData ( ) [ name ]
    if ( !data ) return [ ]
    return [ ...data.static, ...( data.additional ?? [ ] ) ]
  }

  public isHidden ( img: string ): boolean {
    return this.hiddenImages ( ).has ( img )
  }

  public toggleCollapsed ( name: string ): void {
    this.collapsedAlbums.update ( prev => ( { ...prev, [ name ]: !prev [ name ] } ) )
  }

  public async toggleHidden ( img: string ): Promise<void> {
    const next = new Set ( this.hiddenImages ( ) )
    next.has ( img ) ? next.delete ( img ) : next.add ( img )
    this.hiddenImages.set ( next )
    await this.saveSettings ( )
  }

  public async addFromMediaLibrary ( albumName: string ): Promise<void> {
    const ref = this.modalSvc.open ( FileExplorerComponent, { size: "xl", centered: true } )
    ref.componentInstance.isSelectionMode = true

    try {
      const url = await ref.result as string
      if ( !url ) return

      const current = { ...this.additionalImages ( ) }
      current [ albumName ] = [ ...( current [ albumName ] ?? [ ] ), url ]
      this.additionalImages.set ( current )

      const albumDataCopy = { ...this.albumData ( ) }
      albumDataCopy [ albumName ] = {
        ...albumDataCopy [ albumName ],
        additional: current [ albumName ]
      }
      this.albumData.set ( albumDataCopy )

      await this.saveSettings ( )
    } catch {
      // Dismissed without selecting
    }
  }

  public async removeAdditional ( albumName: string, url: string ): Promise<void> {
    const current = { ...this.additionalImages ( ) }
    current [ albumName ] = ( current [ albumName ] ?? [ ] ).filter ( u => u !== url )
    this.additionalImages.set ( current )

    const albumDataCopy = { ...this.albumData ( ) }
    albumDataCopy [ albumName ] = {
      ...albumDataCopy [ albumName ],
      additional: current [ albumName ]
    }
    this.albumData.set ( albumDataCopy )

    const nextHidden = new Set ( this.hiddenImages ( ) )
    nextHidden.delete ( url )
    this.hiddenImages.set ( nextHidden )

    await this.saveSettings ( )
  }


  public previewUrl ( path: string ): string {
    if ( path.startsWith ( "http" ) || path.startsWith ( "/" ) ) return path
    return `/api/img/${path}?w=400&f=webp`
  }

  public isAdditional ( albumName: string, url: string ): boolean {
    return ( this.albumData ( ) [ albumName ]?.additional ?? [ ] ).includes ( url )
  }

  private loadGallery ( ): void {
    this.authSvc.currentUser ( )?.getIdToken ( ).then ( token => {
      return this.apiSvc.get ( "/api/admin/gallery", { }, new HttpHeaders ( { "Authorization": `Bearer ${token || ""}` } ) )
    } ).then ( data => {
      const response = data as {
        albums: Record<string, AlbumData>
        hiddenImages: string [ ]
        additionalImages: Record<string, string [ ]>
      }
      this.albumData.set ( response.albums )
      this.albumNames.set ( Object.keys ( response.albums ) )
      this.hiddenImages.set ( new Set ( response.hiddenImages ) )
      this.additionalImages.set ( response.additionalImages )
      // First 3 albums start expanded, the rest start collapsed
      const collapsed: Record<string, boolean> = { }
      Object.keys ( response.albums ).forEach ( ( name, i ) => {
        collapsed [ name ] = i >= 3
      } )
      this.collapsedAlbums.set ( collapsed )
    } ).catch ( ( ) => {
      this.albumNames.set ( [ ] )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  private async saveSettings ( ): Promise<void> {
    this.saving.set ( true )
    try {
      const token = await this.authSvc.currentUser ( )?.getIdToken ( )
      await this.apiSvc.post (
        "/api/admin/gallery/settings",
        {
          hiddenImages: Array.from ( this.hiddenImages ( ) ),
          additionalImages: this.additionalImages ( )
        },
        new HttpHeaders ( { "Authorization": `Bearer ${token || ""}` } )
      )
    } catch {
      if ( isDevMode ( ) ) console.error ( "Failed to save gallery settings" )
      this.toastrSvc.error ( "Failed to save changes." )
    } finally {
      this.saving.set ( false )
    }
  }
}
