import { ChangeDetectionStrategy, Component, ElementRef, inject, Input, OnInit, Signal, signal, viewChild, WritableSignal } from "@angular/core"
import { FormGroup } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { NgbActiveModal, NgbNavModule } from "@ng-bootstrap/ng-bootstrap"
import { FormlyFieldConfig } from "@ngx-formly/core"
import { DBFile } from "@revive/src/app/interfaces/file.interface"
import { FileService } from "@revive/src/app/services/file.service"
import { IconService } from "@revive/src/app/services/icons.service"

@Component ( {
  selector: "app-new-file-upload",
  imports: [
    FaIconComponent,
    NgbNavModule
  ],
  templateUrl: "./new-file-upload.component.html",
  styleUrl: "./new-file-upload.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} ) export class NewFileUploadComponent implements OnInit {
  @Input ( ) public allowSelectExisting: boolean = false
  @Input ( ) public folderUpload: boolean = false
  @Input ( ) public currentPath: string = "/"

  public fileInput: Signal<ElementRef<HTMLInputElement> | undefined> = viewChild ( "fileInput" )
  public fileInputFolder: Signal<ElementRef<HTMLInputElement> | undefined> = viewChild ( "fileInputFolder" )

  public form: FormGroup = new FormGroup ( { } )
  public model: any = { }
  public fields: FormlyFieldConfig [ ] = [ ]

  public existingFiles: WritableSignal<DBFile[]> = signal ( [ ] )

  public hoveringFile: WritableSignal<boolean> = signal ( false )
  public uploading: WritableSignal<boolean> = signal ( false )
  public activeTab: number = 1

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly activeModal: NgbActiveModal = inject ( NgbActiveModal )
  private readonly fileSvc: FileService = inject ( FileService )

  public constructor ( ) { }

  public ngOnInit ( ): void {
    this.loadExistingFiles ( )
  }

  public async loadExistingFiles ( ): Promise<void> {
    this.existingFiles.set ( await this.fileSvc.getFiles ( ) || [ ] )
  }

  public close ( ): void {
    this.activeModal.dismiss ( )
  }

  public confirm ( ): void {
    if ( this.form.invalid ) return
    this.activeModal.close ( true )
  }

  public onDragOver ( event: DragEvent ) {
    event.preventDefault ( )
    this.hoveringFile.set ( true )
  }

  public onDragLeave ( event: DragEvent ) {
    event.preventDefault ( )
    this.hoveringFile.set ( false )
  }

  public async onDropSuccess ( event: DragEvent ) {
    event.preventDefault ( )
    await this.processUpload ( event.dataTransfer?.files || ( [ ] as unknown as FileList ) )
  }

  public onChange ( event: Event ) {
    event.preventDefault ( )
    this.processUpload ( ( event.target as HTMLInputElement ).files || ( [ ] as unknown as FileList ) )
  }

  private async processUpload ( fileList: FileList ): Promise<void> {
    this.hoveringFile.set ( false )
    this.uploading.set ( true )

    const dataTransfer: FileList = fileList || ( [ ] as unknown as FileList )

    const files: {
      relativePath: string
      files: File [ ]
    } [ ] = [ ]
    for ( let i = 0; i < dataTransfer.length; i++ ) {
      const file = dataTransfer [ i ]

      if ( !file.type ) {
        continue
      }

      if ( !file.type.match ( /(image\/png|image\/jpg|image\/jpeg|application\/pdf)/ ) ) {
        this.toastrSvc.error (  "Please upload only PNG, JPG, JPEG or PDF files.", "Invalid File Type" )
        this.uploading.set ( false )
        return
      }

      if ( file.size > 5.5 * 1024 * 1024 ) {
        this.toastrSvc.error ( `File too large: ${file.name}. Maximum file size is 5.5MB.` )
        this.uploading.set ( false )
        return
      }

      const relativePath = this.currentPath + ( file.webkitRelativePath || "" ).replace ( /[^/]+$/, "" )
      let fileGroup = files.find ( f => f.relativePath === relativePath )

      if ( !fileGroup ) {
        fileGroup = { relativePath, files: [ ] }
        files.push ( fileGroup )
      }

      fileGroup.files.push ( file )
    }

    const totalSize = files?.reduce ( ( acc, fileGroup ) => acc + fileGroup.files.reduce ( ( acc, file ) => acc + file.size, 0 ), 0 ) ?? 0
    if ( totalSize > 20 * 1024 * 1024 ) {
      this.toastrSvc.error ( `Total file size exceeds limit. Maximum total size is 20MB.` )
      this.uploading.set ( false )
      return
    }

    try {
      await this.fileSvc.uploadFiles ( files )
      await Promise.resolve ( )
      this.uploading.set ( false )
      this.activeModal.close ( files )
    } catch {
      this.close ( )
    }
  }
}