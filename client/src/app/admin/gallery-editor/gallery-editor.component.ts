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
import { InputDialogComponent } from "../../formly/input-dialog/input-dialog.component"
import { FormlyService } from "../../services/formly.service"

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
  private readonly formlySvc: FormlyService = inject ( FormlyService )

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
  
  public isCustomAlbum ( name: string ): boolean {
    const data = this.albumData ( ) [ name ]
    if ( !data ) return true
    return data.static.length === 0
  }

  public toggleCollapsed ( name: string ): void {
    this.collapsedAlbums.update ( prev => ( { ...prev, [ name ]: !prev [ name ] } ) )
  }

  public async toggleHidden ( img: string ): Promise<void> {
    const next = new Set ( this.hiddenImages ( ) )
    if ( next.has ( img ) ) { next.delete ( img ) } else { next.add ( img ) }
    this.hiddenImages.set ( next )
    await this.saveSettings ( )
  }

  public async addAlbum ( ): Promise<void> {
    const modalRef = this.modalSvc.open ( InputDialogComponent, { centered: true, size: "md" } )
    modalRef.setInput ( "title", "Create New Album" )
    modalRef.setInput ( "body", "Enter a name for the new album. (Use lowercase, no spaces)" )
    modalRef.setInput ( "fields", [
      this.formlySvc.TextInput ( "albumName", { 
        label: "Album Name", 
        required: true,
        attributes: { pattern: "^[a-z0-9-]+$" },
        placeholder: "e.g., edinburgh-2024"
      } )
    ] )
    modalRef.setInput ( "confirmText", "Create Album" )

    try {
      const result = await modalRef.result as { albumName: string }
      const newName = result.albumName

      if ( this.albumNames ().includes ( newName ) ) {
        this.toastrSvc.error ( "An album with this name already exists." )
        return
      }

      this.albumNames.update ( names => [ ...names, newName ] )

      const currentData = { ...this.albumData () }
      currentData [ newName ] = { static: [], additional: [] }
      this.albumData.set ( currentData )

      const currentAdditional = { ...this.additionalImages () }
      currentAdditional [ newName ] = []
      this.additionalImages.set ( currentAdditional )

      this.collapsedAlbums.update ( c => ( { ...c, [ newName ]: false } ) )

      await this.saveSettings ( )
      this.toastrSvc.success ( "Album created!" )
    } catch {
      // Modal dismissed
    }
  }

  public async deleteAlbum ( name: string ): Promise<void> {
    const confirmed = window.confirm ( `Are you sure you want to delete the entire album "${name}"?\n\nThis will un-link all additional images in this album. This cannot be undone.` )
    if ( !confirmed ) return

    this.albumNames.update ( names => names.filter ( n => n !== name ) )

    this.albumData.update ( data => {
      const cloned = { ...data }
      delete cloned [ name ]
      return cloned
    } )

    this.additionalImages.update ( additional => {
      const cloned = { ...additional }
      delete cloned [ name ]
      return cloned
    } )

    await this.saveSettings ( )
    this.toastrSvc.success ( "Album deleted successfully!" )
  }

  public async addFromMediaLibrary ( albumName: string ): Promise<void> {
    const ref = this.modalSvc.open ( FileExplorerComponent, { size: "xl", centered: true } )
    ref.componentInstance.isSelectionMode = true

    try {
      const result = await ref.result as { url: string; filename: string } | string
      const url = typeof result === "object" ? result.url : result
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

    // Also attempt to delete from R2 if it's an uploaded file
    if ( url.includes ( "/api/share/" ) || url.includes ( "/api/public/s/" ) ) {
      try {
        const uuid = url.split ( "/" ).pop ( )?.split ( "?" ) [ 0 ]
        if ( uuid ) {
          const token = await this.authSvc.currentUser ( )?.getIdToken ( )
          await this.apiSvc.delete ( `/api/admin/gallery/orphaned/${uuid}`, { }, new HttpHeaders ( { "Authorization": `Bearer ${token || ""}` } ) )
        }
      } catch ( e ) {
        if ( isDevMode ( ) ) console.error ( "Failed to delete orphaned file from R2", e )
      }
    }
  }

  public previewUrl ( path: string ): string {
    if ( path.startsWith ( "http" ) || path.startsWith ( "/" ) ) return path
    return `/api/img/${path}?w=400&f=webp`
  }

  public isAdditional ( albumName: string, url: string ): boolean {
    return ( this.albumData ( ) [ albumName ]?.additional ?? [ ] ).includes ( url )
  }

  public async saveSettings ( ): Promise<void> {
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
      // All albums start collapsed
      const collapsed: Record<string, boolean> = { }
      Object.keys ( response.albums ).forEach ( name => {
        collapsed [ name ] = true
      } )
      this.collapsedAlbums.set ( collapsed )
    } ).catch ( ( ) => {
      this.albumNames.set ( [ ] )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }
}
