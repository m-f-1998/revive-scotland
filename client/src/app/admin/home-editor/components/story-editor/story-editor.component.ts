import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { SlicePipe } from "@angular/common"
import { HttpHeaders } from "@angular/common/http"
import { IconComponent } from "../../../../icon/icon.component"
import { ApiService } from "../../../../services/api.service"
import { AuthService } from "../../../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { StoryItem, DEFAULT_STORY } from "../../config/home-editor.config"
import { FormlyService } from "../../../../services/formly.service"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormGroup, FormsModule } from "@angular/forms"

interface StoryModel {
  mediaUrl: string
  items: StoryItem[]
}

const DEFAULT_STORY_MODEL: StoryModel = {
  mediaUrl: "gallery/kinloss/kinloss-8.jpg",
  items: DEFAULT_STORY
}

@Component ( {
  selector: "app-home-story-editor",
  imports: [ IconComponent, SlicePipe, FormlyForm, FormsModule ],
  templateUrl: "./story-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class StoryEditorComponent implements OnInit {
  public form = new FormGroup ( { } )
  public model: WritableSignal<StoryModel> = signal ( DEFAULT_STORY_MODEL )
  public fields: FormlyFieldConfig[] = []
  
  public activeIndex: WritableSignal<number | null> = signal ( null )

  public saving: WritableSignal<boolean> = signal ( false )
  public loading: WritableSignal<boolean> = signal ( true )
  public isDirty: WritableSignal<boolean> = signal ( false )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )

  public ngOnInit ( ): void {
    this.fields = [
      this.formlySvc.ImagePickerInput ( "mediaUrl", { label: "Background Media", required: true, attributes: { accept: "image/*,video/*" } } )
    ]

    this.apiSvc.get ( "/api/admin/our-story" ).then ( d => {
      const res = d as Partial<StoryModel>
      if ( res?.items?.length ) {
        this.model.set ( {
          mediaUrl: res.mediaUrl || DEFAULT_STORY_MODEL.mediaUrl,
          items: res.items
        } )
      } else {
        this.model.set ( { ...DEFAULT_STORY_MODEL, items: DEFAULT_STORY_MODEL.items.map ( c => ( { ...c } ) ) } )
      }
    } ).catch ( ( ) => {
      this.model.set ( { ...DEFAULT_STORY_MODEL, items: DEFAULT_STORY_MODEL.items.map ( c => ( { ...c } ) ) } )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  public onModelChange ( value: StoryModel ): void {
    this.model.set ( value )
    this.isDirty.set ( true )
  }

  public toggleExpand ( index: number ): void {
    this.activeIndex.set ( this.activeIndex ( ) === index ? null : index )
  }

  public add ( ): void {
    this.isDirty.set ( true )
    this.model.update ( model => ( { ...model, items: [ ...model.items, { description: "", bullet: true } ] } ) )
    this.activeIndex.set ( this.model ( ).items.length - 1 )
  }

  public remove ( index: number ): void {
    this.isDirty.set ( true )
    this.model.update ( model => ( { ...model, items: model.items.filter ( ( _, i ) => i !== index ) } ) )
    if ( this.activeIndex ( ) === index ) this.activeIndex.set ( null )
  }

  public moveUp ( index: number ): void {
    if ( index === 0 ) return
    this.isDirty.set ( true )
    this.model.update ( model => {
      const copy = [ ...model.items ]
      ;[ copy[index - 1], copy[index] ] = [ copy[index], copy[index - 1] ]
      return { ...model, items: copy }
    } )
  }

  public moveDown ( index: number ): void {
    if ( index >= this.model ( ).items.length - 1 ) return
    this.isDirty.set ( true )
    this.model.update ( model => {
      const copy = [ ...model.items ]
      ;[ copy[index], copy[index + 1] ] = [ copy[index + 1], copy[index] ]
      return { ...model, items: copy }
    } )
  }

  public updateDescription ( index: number, value: string ): void {
    this.isDirty.set ( true )
    this.model.update ( model => ( { ...model, items: model.items.map ( ( item, i ) => i === index ? { ...item, description: value } : item ) } ) )
  }

  public toggleBullet ( index: number ): void {
    this.isDirty.set ( true )
    this.model.update ( model => ( { ...model, items: model.items.map ( ( item, i ) => i === index ? { ...item, bullet: !item.bullet } : item ) } ) )
  }

  public hasEmpty ( ): boolean {
    return this.model ( ).items.some ( item => !item.description.trim ( ) )
  }

  public async save ( ): Promise<void> {
    if ( this.hasEmpty ( ) ) {
      this.toastrSvc.error ( "All items must have a description before saving." )
      return
    }
    this.saving.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/our-story", this.model ( ), new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Saved successfully!" )
      this.isDirty.set ( false )
    } catch {
      this.toastrSvc.error ( "Failed to save. Please try again." )
    } finally {
      this.saving.set ( false )
    }
  }

  public restoreDefaults ( ): void {
    this.model.set ( { ...DEFAULT_STORY_MODEL, items: DEFAULT_STORY_MODEL.items.map ( c => ( { ...c } ) ) } )
    this.isDirty.set ( true )
    this.activeIndex.set ( null )
  }
}
