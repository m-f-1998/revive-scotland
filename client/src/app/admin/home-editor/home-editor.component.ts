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

interface AboutCard {
  icon: string
  title: string
  description: string
}

const DEFAULT_WEEKENDS = {
  title: "Revive Weekends",
  videoUrl: "/api/img/gallery/kinloss/kinloss-14.mp4",
  description: "A Revive Weekend is a profound Catholic experience designed to delve deeper into specific aspects of the faith while fostering a sense of community and spiritual growth among young adults.\n\nRooted in prayer, particularly through the Mass, adoration and the rosary, these weekends offer participants an opportunity for profound spiritual renewal and connection with God. The core aim of Revive Weekends is to bring young adults together in a supportive environment where they can deepen their understanding of the Catholic faith and build lasting friendships.\n\nAlongside structured prayer, Revive Weekends also include quality social time, engaging games, and thoughtful discussions aimed at facilitating personal reflection and sharing.\n\nWhether through moments of worship, fellowship, or recreation, Revive Weekends provide an experience that nurtures both the soul and the spirit, empowering participants to grow in their faith and relationship with God while forging meaningful connections with others on the journey of faith."
}

const DEFAULT_PILGRIMAGE = {
  heading: "Pilgrimages",
  body: "All our pilgrimages are in a true spirit of simplicity where we forgo the luxuries and pleasures of the world in order to be able to appreciate the basic things in life. All pilgrimages include daily mass and prayer time and a series of formational talks. We are also able to design and lead pilgrimages suited for parish, youth and other groups. Please contact us directly if you wish to set up a custom pilgrimage.",
  image: "pilgrimage.jpg"
}

const DEFAULT_ADORATION = {
  title: "Adoration Missions",
  body: "We offer to run a parish adoration mission in which we work together with the parish priest to prepare and run continuous adoration for set periods of time either with the goal of increasing already existing adoration in the parish or to help begin this devotional practice. For more information on what a mission can look like, please Contact Us."
}

const DEFAULT_ABOUT_CARDS: AboutCard [ ] = [
  {
    icon: "bible",
    title: "Scripture",
    description: "We promote the basic message of the Gospel and the transformative truth that the Holy Spirit is living and active within hearts that are in a state of grace."
  },
  {
    icon: "church",
    title: "Transformed by the Spirit",
    description: "We aim to provide a space for people to encounter the love of God and to be transformed by the power of the Holy Spirit."
  },
  {
    icon: "praying-hands",
    title: "Evangelisation",
    description: "We focus, but are not limited to the evangelisation of youth and young adults with the aim to lead them to live a grace filled lifestyle, actively giving back to their own parish community."
  }
]

const DEFAULT_SLIDES: SlideModel [ ] = [
  {
    id: "hero-1",
    title: "Revive Scotland",
    description: "We are dedicated to reviving the faith in people's hearts through the power of the Holy Spirit. We deliver this through formation, community and prayer; mainly Pilgrimages, Revive Weekends and Eucharistic Adoration.",
    url: "gallery/kinloss/kinloss-13.jpg"
  },
  {
    id: "hero-2",
    title: "Join the Prayer",
    description: "Revive exists to give people a real and transformational HOPE, through a FAITH filled lifestyle centered on the sacraments, catechesis and real authentic friendships as a way to encounter God's LOVE.",
    url: "gallery/dunoon/dunoon-1.jpg"
  },
  {
    id: "hero-3",
    title: "God is Love",
    description: "'Let anyone who is thirsty come to me and drink. Whoever believes in me, as Scripture has said, rivers of living water will flow from within them. By this he meant the Holy Spirit' (Jn 7:38-39)",
    url: "gallery/skye/skye-1.jpg"
  }
]

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
        if ( res?.title ) {
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
    this.weekendsForm.markAsPristine ( )
    this.defaultSections.update ( s => ( { ...s, weekends: true } ) )
  }

  public restorePilgrimage ( ): void {
    this.pilgrimageModel.set ( { ...DEFAULT_PILGRIMAGE } )
    this.pilgrimageForm.markAsPristine ( )
    this.defaultSections.update ( s => ( { ...s, pilgrimage: true } ) )
  }

  public restoreAdoration ( ): void {
    this.adorationModel.set ( { ...DEFAULT_ADORATION } )
    this.adorationForm.markAsPristine ( )
    this.defaultSections.update ( s => ( { ...s, adoration: true } ) )
  }

  public restoreAboutCards ( ): void {
    this.aboutCards.set ( DEFAULT_ABOUT_CARDS.map ( c => ( { ...c } ) ) )
    this.defaultSections.update ( s => ( { ...s, about: true } ) )
    this.dirtyManual.update ( s => ( { ...s, about: false } ) )
  }

  public restoreSlides ( ): void {
    this.slidesForms.set ( this.buildSlideForms ( DEFAULT_SLIDES ) )
    this.defaultSections.update ( s => ( { ...s, slider: true } ) )
    this.dirtyManual.update ( s => ( { ...s, slider: false } ) )
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
    if ( this.slidesForms ( ).length >= 3 ) {
      this.toastrSvc.error ( "Maximum 3 slides allowed." )
      return
    }
    this.dirtyManual.update ( s => ( { ...s, slider: true } ) )
    this.slidesForms.update ( forms => [ ...forms, {
      form: new FormGroup ( { } ),
      model: signal<Record<string, unknown>> ( {
        id: `hero-${Date.now ( )}`,
        title: "New Slide Title",
        description: "Enter slide content here...",
        url: ""
      } ),
      fields: this.getSlideFields ( )
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
      fields: this.getSlideFields ( )
    } ) )
  }

  private getSlideFields ( ): FormlyFieldConfig [ ] {
    return [
      this.formlySvc.TextInput ( "title", { label: "Title", required: true, maxLength: 100 } ),
      this.formlySvc.TextAreaInput ( "description", { label: "Text", required: true, maxLength: 500, includeMaxDescription: true } ),
      this.formlySvc.ImagePickerInput ( "url", { label: "Image", required: true } )
    ]
  }

  private async loadSection ( section: string ): Promise<unknown> {
    try {
      return await this.apiSvc.get ( `/api/admin/site-content/${section}` )
    } catch {
      return null
    }
  }
}
