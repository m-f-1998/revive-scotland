import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { NgbDropdownModule, NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { InputDialogComponent } from "@revive/src/app/formly/input-dialog/input-dialog.component"
import { FileNode } from "@revive/src/app/interfaces/file.interface"
import { FileService } from "@revive/src/app/services/file.service"
import { IconService } from "@revive/src/app/services/icons.service"
import { NewFileUploadComponent } from "../new-file-upload/new-file-upload.component"

@Component ( {
  selector: "app-file-browser",
  imports: [
    FaIconComponent,
    NgbDropdownModule
  ],
  templateUrl: "./file-browser.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FileBrowserComponent {
  public fileTree: WritableSignal<FileNode[]> = signal<FileNode[]> ( [ ] )
  public currentPath: WritableSignal<string> = signal <string> ( "/" )
  public selectedNodes: WritableSignal<Set<string>> = signal<Set<string>> ( new Set ( ) )
  public loading: WritableSignal<boolean> = signal ( true )

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly fileSvc: FileService = inject ( FileService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )

  public constructor ( ) {
    this.fileSvc.getFiles ( ).then ( files => {
      this.fileTree.set ( this.fileSvc.buildFileTree ( files || [ ] ) )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public get currentFolder ( ): FileNode [ ] {
    const parts = this.currentPath ( ).split ( "/" ).filter ( Boolean )
    let level = this.fileTree ( )
    for ( const part of parts ) {
      const folder = level.find ( n => n.name === part && n.isFolder )
      if ( !folder?.children ) break
      level = folder.children
    }
    return level
  }

  public get breadcrumbs ( ) {
    const parts = this.currentPath ( ).split ( "/" ).filter ( Boolean )
    const paths: { name: string; path: string } [ ] = [ ]
    let current = ""
    for ( const part of parts ) {
      current += `/${part}`
      paths.push ( { name: part, path: current } )
    }
    return paths
  }

  // Navigation
  public navigateTo ( path: string ) {
    this.currentPath.set ( path )
  }

  public navigateInto ( node: FileNode ) {
    if ( node.isFolder ) {
      this.navigateTo ( node.path )
    } else {
      window.open ( `/api/files/download/${node.file?.id}`, "_blank" )
    }
  }

  public download ( node: FileNode ) {
    window.open ( `/api/files/download/${node.file?.id}`, "_blank" )
  }

  public toggleSelection ( node: FileNode ) {
    const set = new Set ( this.selectedNodes ( ) )
    if ( set.has ( node.path ) ) set.delete ( node.path )
    else set.add ( node.path )
    this.selectedNodes.set ( set )
  }

  public isSelected ( node: FileNode ) {
    return this.selectedNodes ( ).has ( node.path )
  }

  public async deleteFile ( file: FileNode ): Promise<void> {
    if ( !confirm ( "Are you sure you want to delete this file? This action cannot be undone." ) ) return

    this.loading.set ( true )
    try {
      if ( file.id ) {
        // It's a file
        await this.fileSvc.deleteFile ( file.id )
        this.fileTree.set ( this.fileTree ( ).filter ( f => f.id !== file.id ) )
      } else {
        // It's a folder: recursively collect all file ids in this folder and delete them
        const collectFileIds = ( nodes: FileNode [ ] ): string [ ] => {
          let ids: string [ ] = [ ]
          for ( const node of nodes ) {
            if ( node.isFolder && node.children ) {
              ids = ids.concat ( collectFileIds ( node.children ) )
            } else if ( node.id ) {
              ids.push ( node.id )
            }
          }
          return ids
        }

        const parts = file.path.split ( "/" ).filter ( Boolean )
        let level = this.fileTree ( )
        let folder: FileNode | undefined
        for ( const part of parts ) {
          folder = level.find ( n => n.name === part && n.isFolder )
          if ( !folder?.children ) break
          level = folder.children
        }
        if ( folder?.children ) {
          const idsToDelete = collectFileIds ( folder.children )
          for ( const id of idsToDelete ) {
            await this.fileSvc.deleteFile ( id )
          }
        }

        // Remove the folder from the fileTree
        const removeFolder = ( nodes: FileNode [ ], path: string ): FileNode [ ] => {
          return nodes.filter ( n => n.path !== path ).map ( n =>
            n.isFolder && n.children
              ? { ...n, children: removeFolder ( n.children, path ) }
              : n
          )
        }
        this.fileTree.set ( removeFolder ( this.fileTree ( ), file.path ) )
      }
    } catch ( err ) {
      console.error ( "Failed to delete file", err )
      alert ( "Failed to delete file" )
    } finally {
      this.loading.set ( false )
    }
  }

  public moreInfo ( file: FileNode ): void {
    if ( !file || !file.file ) return

    const modalRef = this.modalSvc.open ( InputDialogComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.title = "File Information"
    modalRef.componentInstance.hideConfirmButton = true
    modalRef.componentInstance.fields = [
      {
        key: "name",
        type: "input",
        templateOptions: {
          label: "File Name",
          disabled: true
        }
      },
      {
        key: "path",
        type: "input",
        templateOptions: {
          label: "Location",
          disabled: true
        }
      },
      {
        key: "mimeType",
        type: "input",
        templateOptions: {
          label: "MIME Type",
          disabled: true
        }
      },
      {
        key: "createdAt",
        type: "input",
        templateOptions: {
          label: "Uploaded At",
          disabled: true
        }
      },
      {
        key: "updatedAt",
        type: "input",
        templateOptions: {
          label: "Last Updated At",
          disabled: true
        }
      }
    ]

    modalRef.componentInstance.model = {
      name: file.name,
      path: file.path === "/" ? "/" : "/" + file.path.split ( "/" ).filter ( Boolean ).slice ( 0, -1 ).join ( "/" ),
      mimeType: file.file?.mime_type || "N/A",
      createdAt: file?.file?.file_created_at ? new Date ( file.file.file_created_at ).toLocaleString ( ) : "N/A",
      updatedAt: file.file?.file_updated_at ? new Date ( file.file.file_updated_at ).toLocaleString ( ) : "N/A"
    }
    modalRef.result.catch ( ( ) => { } ) // Handle dismissal
  }

  public upload ( file: boolean = true ): void {
    const modalRef = this.modalSvc.open ( NewFileUploadComponent, { size: "lg", backdrop: "static" } )
    modalRef.componentInstance.folderUpload = !file
    modalRef.componentInstance.currentPath = ( this.currentPath ( ) ?? "" ) + "/"
    modalRef.result.then ( res => {
      if ( res.length ) {
        this.loading.set ( true )
        this.fileSvc.getFiles ( true ).then ( files => {
          this.fileTree.set ( this.fileSvc.buildFileTree ( files || [ ] ) )
        } ).finally ( ( ) => {
          this.loading.set ( false )
        } )
      }
    } ).catch ( ( ) => { } ) // Handle dismissal
  }
}