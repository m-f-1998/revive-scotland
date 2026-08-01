import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { IconPickerComponent } from "../icon-picker/icon-picker.component"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormGroup } from "@angular/forms"
import { FormsModule } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { FormlyService } from "../../services/formly.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { HttpHeaders } from "@angular/common/http"
import { AboutCard, DEFAULT_ABOUT_CARDS, DEFAULT_ADORATION, DEFAULT_PILGRIMAGE, DEFAULT_SLIDES, DEFAULT_WEEKENDS, getSlideFields } from "./config/home-editor.config"

interface SlideModel {
  id: string
  url: string
  title: string
  description: string
}

interface SlideFormEntry {
  form: FormGroup
  model: WritableSignal<Record<string, unknown>>
  fields: FormlyFieldConfig [ ]
}

@Component ( {
  selector: "app-admin-home-editor",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, IconPickerComponent, FormlyForm, FormsModule ],
  templateUrl: "./home-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class HomeEditorComponent implements OnInit {
  // Section collapse state — all start closed
  public collapsed: WritableSignal<Record<string, boolean>> = signal ( {
    slider: true,
    weekends: true,
    pilgrimage: true,
    adoration: true,
    about: true
  } )

  // Loading per section
  public saving: WritableSignal<Record<string, boolean>> = signal ( { } )
  public loading: WritableSignal<boolean> = signal ( true )

  // Tracks which sections are showing defaults (not yet saved by user)
  public defaultSections: WritableSignal<Record<string, boolean>> = signal ( { } )
  // Tracks dirty state for manually-edited sections (about cards, slides)
  public dirtyManual: WritableSignal<Record<string, boolean>> = signal ( { } )

  // Revive Weekends
  public weekendsForm = new FormGroup ( { } )
  public weekendsModel: WritableSignal<Record<string, unknown>> = signal ( { } )
  public weekendsFields: FormlyFieldConfig [ ] = [ ]

  // Pilgrimage
  public pilgrimageForm = new FormGroup ( { } )
  public pilgrimageModel: WritableSignal<Record<string, unknown>> = signal ( { } )
  public pilgrimageFields: FormlyFieldConfig [ ] = [ ]

  // Adoration
  public adorationForm = new FormGroup ( { } )
  public adorationModel: WritableSignal<Record<string, unknown>> = signal ( { } )
  public adorationFields: FormlyFieldConfig [ ] = [ ]

  // About Us cards
  public aboutCards: WritableSignal<AboutCard [ ]> = signal ( DEFAULT_ABOUT_CARDS )

  // Home Slides — each slide has its own form + signal model
  public slidesForms: WritableSignal<SlideFormEntry [ ]> = signal ( [ ] )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.weekendsFields = [
      this.formlySvc.TextInput ( "title", { label: "Title", required: true, maxLength: 100 } ),
      this.formlySvc.TextAreaInput ( "description", { label: "Description", required: true, maxLength: 2000, includeMaxDescription: true } ),
      this.formlySvc.ImagePickerInput ( "videoUrl", { label: "Video", placeholder: "Select or enter video URL", required: true } )
    ]

    this.pilgrimageFields = [
      this.formlySvc.TextInput ( "heading", { label: "Heading", required: true, maxLength: 100 } ),
      this.formlySvc.TextAreaInput ( "body", { label: "Body Text", required: true, maxLength: 1000, includeMaxDescription: true } ),
      this.formlySvc.ImagePickerInput ( "image", { label: "Background Image", required: true } )
    ]

    this.adorationFields = [
      this.formlySvc.TextInput ( "title", { label: "Title", required: true, maxLength: 100 } ),
      this.formlySvc.TextAreaInput ( "body", { label: "Body Text", required: true, maxLength: 1000, includeMaxDescription: true } )
    ]

    Promise.all ( [
      this.loadSection ( "revive-weekends" ).then ( d => {
        const res = d as Partial<typeof DEFAULT_WEEKENDS>
        if ( res?.heading ) {
          this.weekendsModel.set ( d as Record<string, unknown> )
        } else {
          this.weekendsModel.set ( { ...DEFAULT_WEEKENDS } )
          this.defaultSections.update ( s => ( { ...s, weekends: true } ) )
        }
      } ),
      this.loadSection ( "pilgrimage" ).then ( d => {
        const res = d as Partial<typeof DEFAULT_PILGRIMAGE>
        if ( res?.heading ) {
          this.pilgrimageModel.set ( d as Record<string, unknown> )
        } else {
          this.pilgrimageModel.set ( { ...DEFAULT_PILGRIMAGE } )
          this.defaultSections.update ( s => ( { ...s, pilgrimage: true } ) )
        }
      } ),
      this.loadSection ( "adoration" ).then ( d => {
        const res = d as Partial<typeof DEFAULT_ADORATION>
        if ( res?.title ) {
          this.adorationModel.set ( d as Record<string, unknown> )
        } else {
          this.adorationModel.set ( { ...DEFAULT_ADORATION } )
          this.defaultSections.update ( s => ( { ...s, adoration: true } ) )
        }
      } ),
      this.loadSection ( "about-us" ).then ( d => {
        const res = d as { cards?: AboutCard [ ] }
        if ( res?.cards?.length ) {
          this.aboutCards.set ( res.cards )
        } else {
          this.defaultSections.update ( s => ( { ...s, about: true } ) )
        }
      } ),
      this.apiSvc.get ( "/api/admin/hero-editor/home" ).then ( d => {
        const res = d as { heroes?: SlideModel [ ] }
        if ( res?.heroes?.length ) {
          this.slidesForms.set ( this.buildSlideForms ( res.heroes ) )
        } else {
          this.slidesForms.set ( this.buildSlideForms ( DEFAULT_SLIDES ) )
          this.defaultSections.update ( s => ( { ...s, slider: true } ) )
        }
      } )
    ] ).finally ( ( ) => this.loading.set ( false ) )
  }

  public isDefault ( key: string ): boolean {
    return this.defaultSections ( ) [ key ] === true
  }

  public isSaveDisabled ( key: string, form?: FormGroup ): boolean {
    if ( !this.isDefault ( key ) ) return false
    if ( form ) return form.pristine
    return !this.dirtyManual ( ) [ key ]
  }

  public onFormlyChange ( key: string, modelSignal: WritableSignal<Record<string, unknown>>, value: Record<string, unknown> ): void {
    modelSignal.set ( value )
    if ( this.isDefault ( key ) ) {
      this.defaultSections.update ( s => ( { ...s, [ key ]: false } ) )
    }
  }

  public toggleSection ( key: string ): void {
    this.collapsed.update ( c => ( { ...c, [ key ]: !c [ key ] } ) )
  }

  public isSaving ( key: string ): boolean {
    return !!this.saving ( ) [ key ]
  }

  public async saveSection ( section: string, sectionKey: string, body: unknown ): Promise<void> {
    this.saving.update ( s => ( { ...s, [ section ]: true } ) )
    try {
      await this.apiSvc.post ( `/api/admin/site-content/${section}`, body as Record<string, unknown>, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Saved successfully!" )
      this.defaultSections.update ( s => ( { ...s, [ sectionKey ]: false } ) )
      this.dirtyManual.update ( s => ( { ...s, [ sectionKey ]: false } ) )
    } catch {
      this.toastrSvc.error ( "Failed to save. Please try again." )
    } finally {
      this.saving.update ( s => ( { ...s, [ section ]: false } ) )
    }
  }

  public async saveSlider ( ): Promise<void> {
    if ( this.slidesForms ( ).some ( sf => !sf.model ( ) [ "url" ] ) ) {
      this.toastrSvc.error ( "Please ensure all slides have an image." )
      return
    }
    this.saving.update ( s => ( { ...s, slider: true } ) )
    try {
      const heroes = this.slidesForms ( ).map ( sf => sf.model ( ) )
      await this.apiSvc.post ( "/api/admin/hero-editor/home", { heroes }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Saved successfully!" )
      this.defaultSections.update ( s => ( { ...s, slider: false } ) )
      this.dirtyManual.update ( s => ( { ...s, slider: false } ) )
    } catch {
      this.toastrSvc.error ( "Failed to save. Please try again." )
    } finally {
      this.saving.update ( s => ( { ...s, slider: false } ) )
    }
  }

  // Restore defaults
  public restoreWeekends ( ): void {
    this.weekendsModel.set ( { ...DEFAULT_WEEKENDS } )
    this.weekendsForm.markAsDirty ( )
    this.defaultSections.update ( s => ( { ...s, weekends: true } ) )
  }

  public restorePilgrimage ( ): void {
    this.pilgrimageModel.set ( { ...DEFAULT_PILGRIMAGE } )
    this.pilgrimageForm.markAsDirty ( )
    this.defaultSections.update ( s => ( { ...s, pilgrimage: true } ) )
  }

  public restoreAdoration ( ): void {
    this.adorationModel.set ( { ...DEFAULT_ADORATION } )
    this.adorationForm.markAsDirty ( )
    this.defaultSections.update ( s => ( { ...s, adoration: true } ) )
  }

  public restoreAboutCards ( ): void {
    this.aboutCards.set ( DEFAULT_ABOUT_CARDS.map ( c => ( { ...c } ) ) )
    this.defaultSections.update ( s => ( { ...s, about: true } ) )
    this.dirtyManual.update ( s => ( { ...s, about: true } ) )
  }

  public restoreSlides ( ): void {
    this.slidesForms.set ( this.buildSlideForms ( DEFAULT_SLIDES ) )
    this.defaultSections.update ( s => ( { ...s, slider: true } ) )
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
  }

  // About Us helpers
  public updateCard ( index: number, field: keyof AboutCard, value: string ): void {
    this.dirtyManual.update ( s => ( { ...s, about: true } ) )
    this.aboutCards.update ( cards => cards.map ( ( c, i ) => i === index ? { ...c, [ field ]: value } : c ) )
  }

  // Slide helpers
  public onSlideChange ( _index: number, entry: SlideFormEntry, value: Record<string, unknown> ): void {
    entry.model.set ( value )
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
  }

  public addSlide ( ): void {
    if ( this.slidesForms ( ).length >= 3 ) return
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
    this.slidesForms.update ( forms => [ ...forms, {
      form: new FormGroup ( { } ),
      model: signal<Record<string, unknown>> ( {
        id: `hero-${Date.now ( )}`,
        title: "",
        description: "",
        url: ""
      } ),
      fields: getSlideFields ( this.formlySvc )
    } ] )
  }

  public removeSlide ( index: number ): void {
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
    this.slidesForms.update ( forms => forms.filter ( ( _, i ) => i !== index ) )
  }

  private buildSlideForms ( slides: SlideModel [ ] ): SlideFormEntry [ ] {
    return slides.map ( slide => ( {
      form: new FormGroup ( { } ),
      model: signal<Record<string, unknown>> ( { ...slide } ),
      fields: getSlideFields ( this.formlySvc )
    } ) )
  }

  private async loadSection ( section: string ): Promise<unknown> {
    try {
      return await this.apiSvc.get ( `/api/admin/site-content/${section}` )
    } catch {
      return null
    }
  }
}
