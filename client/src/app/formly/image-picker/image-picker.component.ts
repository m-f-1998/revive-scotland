import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { FileExplorerComponent } from "../../admin/file-explorer/file-explorer.component"
import { ModalService } from "@app/services/modal.service"
import { IconComponent } from "../../icon/icon.component"
import { takeUntilDestroyed, toObservable } from "@angular/core/rxjs-interop"
import { DestroyRef } from "@angular/core"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { HttpErrorResponse, HttpHeaders } from "@angular/common/http"
import { ToastrService } from "@m-f-1998/ngx-toastr"

@Component ( {
  selector: "app-formly-image-picker",
  imports: [
    IconComponent
  ],
  templateUrl: "./image-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ImagePickerComponent extends FieldType implements OnInit {
  public readonly value: WritableSignal<string> = signal ( "" )
  public displayFilename: WritableSignal<string> = signal ( "" )
  public uploading: WritableSignal<boolean> = signal ( false )

  private readonly modalSvc: ModalService = inject ( ModalService )
  private readonly destroyRef: DestroyRef = inject ( DestroyRef )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public constructor ( ) {
    super ( )
    toObservable ( this.authSvc.currentUser )
      .pipe ( takeUntilDestroyed ( this.destroyRef ) )
      .subscribe ( user => {
        if ( user ) {
          this.updateDisplayFilename ( this.formControl?.value ?? "" )
        }
      } )
  }

  public get previewUrl ( ): string {
    const val = this.value ( )
    if ( !val ) return ""
    if ( val.startsWith ( "http" ) || val.startsWith ( "/" ) ) return val
    return `/api/img/${val}`
  }

  public get isVideo ( ): boolean {
    return this.previewUrl.toLowerCase ( ).endsWith ( ".mp4" )
  }

  public ngOnInit ( ): void {
    const initial = this.formControl?.value ?? ""
    this.formControl?.setValue ( initial )
    this.value.set ( initial )
    this.updateDisplayFilename ( initial )

    this.formControl.valueChanges
      .pipe ( takeUntilDestroyed ( this.destroyRef ) )
      .subscribe ( v => {
        this.value.set ( v ?? "" )
        this.updateDisplayFilename ( v ?? "" )
      } )
  }

  public openPreview ( ): void {
    if ( this.previewUrl ) {
      window.open ( this.previewUrl, "_blank" )
    }
  }

  public openFileSelector ( ): void {
    const modalRef = this.modalSvc.open ( FileExplorerComponent, { size: "lg", centered: true } )

    modalRef.componentInstance.isSelectionMode = true

    modalRef.result.then ( ( result: { url: string; filename: string } | string | undefined ) => {
      if ( result ) {
        if ( typeof result === "object" && result.url ) {
          // Store the display filename
          this.displayFilename.set ( result.filename || "" )
          // Save the clean URL to the actual form control
          this.formControl?.setValue ( result.url )
          this.formControl?.markAsDirty ( )
          this.formControl?.markAsTouched ( )
        } else if ( typeof result === "string" ) {
          this.formControl?.setValue ( result )
          this.formControl?.markAsDirty ( )
          this.formControl?.markAsTouched ( )
        }
      }
    } ).catch ( ( ) => { /* Modal dismissed */ } )
  }

  public async onQuickUpload ( event: Event ): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.item ( 0 )

    if ( !file ) return

    if ( file.size > 20 * 1024 * 1024 ) {
      this.toastrSvc.error ( "File is too large (max 20MB)." )
      return
    }

    const accept = this.props.attributes?. [ "accept" ] as string
    if ( accept ) {
      const acceptedTypes = accept.split ( "," ).map ( t => t.trim ( ).toLowerCase ( ) )
      const fileType = file.type.toLowerCase ( )
      const isAccepted = acceptedTypes.some ( type => {
        if ( type.endsWith ( "/*" ) ) {
          return fileType.startsWith ( type.replace ( "/*", "" ) )
        }
        return fileType === type || file.name.toLowerCase ( ).endsWith ( type )
      } )

      if ( !isAccepted ) {
        this.toastrSvc.error ( `Invalid file type. Accepted types: ${accept}` )
        input.value = "" // Reset input
        return
      }
    }

    this.uploading.set ( true )

    try {
      const user = await this.authSvc.currentUser ( )
      const token = await user?.getIdToken ( ) || ""
      const headers = new HttpHeaders ( { "Authorization": `Bearer ${token}` } )

      const safeName = file.name.replace ( /[^a-zA-Z0-9.-]/g, "_" )
      const fullKey = `users/${user?.uid}/uploads/${Date.now ( )}-${safeName}`

      // 1. Get upload URL
      const response = await this.apiSvc.post ( "/api/admin/file-explorer/upload-url", {
        key: fullKey,
        fileSize: file.size,
        contentType: file.type || "application/octet-stream"
      }, headers ) as { uploadUrl: string }

      // 2. Upload to R2
      const uploadRes = await fetch ( response.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      } )

      if ( !uploadRes.ok ) {
        throw new Error ( "R2 upload failed" )
      }

      // 3. Complete upload
      await this.apiSvc.post ( "/api/admin/file-explorer/upload-complete", {
        key: fullKey,
        fileSize: file.size
      }, headers )

      // 4. Get Share URL to use in the form
      const shareRes = await this.apiSvc.get ( "/api/admin/file-explorer/share-url", {
        key: fullKey,
        expiresIn: 0
      }, headers ) as { shareUrl: string }

      const shareUrl = shareRes.shareUrl
      const relativePath = shareUrl.startsWith ( "http" ) ? new URL ( shareUrl ).pathname : shareUrl

      this.displayFilename.set ( file.name )
      this.formControl?.setValue ( relativePath )
      this.formControl?.markAsDirty ( )
      this.formControl?.markAsTouched ( )

      this.toastrSvc.success ( "File uploaded successfully." )

    } catch ( err ) {
      if ( err instanceof HttpErrorResponse ) {
        this.toastrSvc.error ( err.error || "Upload failed." )
      } else {
        this.toastrSvc.error ( "Upload failed." )
      }
    } finally {
      this.uploading.set ( false )
      input.value = "" // Reset input
    }
  }

  private async updateDisplayFilename ( val: string ): Promise<void> {
    if ( !val ) {
      this.displayFilename.set ( "" )
      return
    }

    // Only update if we don't already have a friendly filename set from the selector
    // (This handles initial load where we only have the URL)
    if ( !this.displayFilename ( ) || this.displayFilename ( ).length > 40 ) {
      const isShareUrl = val.includes ( "/api/share/" ) || val.includes ( "/api/public/s/" )

      if ( isShareUrl ) {
        const uuid = val.split ( "/" ).pop ( )?.split ( "?" ) [ 0 ]
        if ( uuid ) {
          try {
            const token = await this.authSvc.currentUser ( )?.getIdToken ( ) || ""
            const res = await this.apiSvc.get ( `/api/admin/file-explorer/share-info/${uuid}`, { }, new HttpHeaders ( {
              "Authorization": `Bearer ${token}`
            } ) ) as { filename: string }

            if ( res && res.filename ) {
              this.displayFilename.set ( res.filename )
              return
            }
          } catch {
            // Fall through to fallback
          }
        }
      }

      // Fallback to the last segment of the path
      const parts = val.split ( "?" ) [ 0 ].split ( "/" )
      this.displayFilename.set ( parts [ parts.length - 1 ] )
    }
  }
}