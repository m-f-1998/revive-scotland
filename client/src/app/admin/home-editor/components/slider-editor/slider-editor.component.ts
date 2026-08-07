import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { FormGroup, FormsModule } from "@angular/forms"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { HttpHeaders } from "@angular/common/http"
import { IconComponent } from "../../../../icon/icon.component"
import { ApiService } from "../../../../services/api.service"
import { AuthService } from "../../../../services/auth.service"
import { FormlyService } from "../../../../services/formly.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { DEFAULT_SLIDES, getSlideFields } from "../../config/home-editor.config"

interface SlideModel {
  id: string
  url: string
  title: string
  description: string
}

interface SlideFormEntry {
  form: FormGroup
  model: WritableSignal<Record<string, unknown>>
  fields: FormlyFieldConfig[]
}

@Component ( {
  selector: "app-home-slider-editor",
  imports: [ IconComponent, FormlyForm, FormsModule ],
  templateUrl: "./slider-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class SliderEditorComponent implements OnInit {
  public slidesForms: WritableSignal<SlideFormEntry[]> = signal ( [ ] )
  public activeSlideIndex: WritableSignal<number> = signal ( 0 )
  public saving: WritableSignal<boolean> = signal ( false )
  public loading: WritableSignal<boolean> = signal ( true )
  public isDirty: WritableSignal<boolean> = signal ( false )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/hero-editor/home" ).then ( d => {
      const res = d as { heroes?: SlideModel[] }
      if ( res?.heroes?.length ) {
        this.slidesForms.set ( this.buildSlideForms ( res.heroes ) )
      } else {
        this.slidesForms.set ( this.buildSlideForms ( DEFAULT_SLIDES ) )
      }
    } ).catch ( ( ) => {
      this.slidesForms.set ( this.buildSlideForms ( DEFAULT_SLIDES ) )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  public isSaveDisabled ( ): boolean {
    if ( !this.isDirty ( ) ) return true
    return this.slidesForms ( ).some ( sf => sf.form.invalid )
  }

  public async save ( ): Promise<void> {
    if ( this.slidesForms ( ).some ( sf => !sf.model ( )["url"] ) ) {
      this.toastrSvc.error ( "Please ensure all slides have an image." )
      return
    }
    this.saving.set ( true )
    try {
      const heroes = this.slidesForms ( ).map ( sf => sf.model ( ) )
      await this.apiSvc.post ( "/api/admin/hero-editor/home", { heroes }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Saved successfully!" )
      this.isDirty.set ( false )
      this.slidesForms ( ).forEach ( sf => sf.form.markAsPristine ( ) )
    } catch {
      this.toastrSvc.error ( "Failed to save. Please try again." )
    } finally {
      this.saving.set ( false )
    }
  }

  public restoreDefaults ( ): void {
    const clonedSlides = DEFAULT_SLIDES.map ( slide => ( { ...slide } ) )
    this.slidesForms.set ( this.buildSlideForms ( clonedSlides ) )
    this.isDirty.set ( true )
    this.activeSlideIndex.set ( 0 )
  }

  public onSlideChange ( _index: number, entry: SlideFormEntry, value: Record<string, unknown> ): void {
    entry.model.set ( value )
    this.isDirty.set ( true )
  }

  public addSlide ( ): void {
    if ( this.slidesForms ( ).length >= 3 ) return
    this.isDirty.set ( true )
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
    this.activeSlideIndex.set ( this.slidesForms ( ).length - 1 )
  }

  public removeSlide ( index: number ): void {
    this.isDirty.set ( true )
    this.slidesForms.update ( forms => forms.filter ( ( _, i ) => i !== index ) )
    const len = this.slidesForms ( ).length
    if ( this.activeSlideIndex ( ) >= len ) {
      this.activeSlideIndex.set ( Math.max ( 0, len - 1 ) )
    }
  }

  private buildSlideForms ( slides: SlideModel[] ): SlideFormEntry[] {
    return slides.map ( slide => ( {
      form: new FormGroup ( { } ),
      model: signal<Record<string, unknown>> ( { ...slide } ),
      fields: getSlideFields ( this.formlySvc )
    } ) )
  }
}
