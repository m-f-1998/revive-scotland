import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { ApiService } from "../../services/api.service"
import { HeroEntry, PageHeroData } from "../../interfaces/heroEditor.interface"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { HttpHeaders } from "@angular/common/http"
import { AuthService } from "../../services/auth.service"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormGroup } from "@angular/forms"
import { FormlyService } from "../../services/formly.service"
import { AdminFooterComponent } from "../footer/footer.component"

@Component ( {
  selector: "app-admin-hero-editor",
  imports: [
    AdminNavbarComponent,
    FaIconComponent,
    FormlyForm,
    AdminFooterComponent
  ],
  templateUrl: "./hero-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class HeroEditorComponent implements OnInit {
  public readonly maxHeroes = 3

  public heroData: WritableSignal<PageHeroData[]> = signal ( [ ] )
  public loading: WritableSignal<boolean> = signal ( false )

  public form: FormGroup = new FormGroup ( { } )
  public model: any = { }
  public fields: FormlyFieldConfig [ ] = [ ]

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )
  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly formlySvc: FormlyService = inject ( FormlyService )

  public ngOnInit ( ): void {
    this.fields = [
      this.formlySvc.SelectInput ( "pageID", {
        label: "Page Selection",
        options: [
          { label: "Home Page", value: "home" },
          { label: "Events", value: "events" },
        ],
        required: true,
        change: ( ) => {
          this.fetchHeroData ( )
        }
      }, {
        defaultValue: "home"
      } )
    ]
    this.model = {
      pageID: "home"
    }
    this.fetchHeroData ( )
  }

  public addNewHero ( ) {
    if ( this.heroData ( ).length >= this.maxHeroes ) {
      this.toastrSvc.error ( `Cannot add more than ${this.maxHeroes} heroes.` )
      return
    }
    this.heroData.update ( data => [
      ...data,
      {
        id: `hero-${Date.now ( )}`,
        fields: this.getHeroEntryFields ( ),
        model: { },
        form: new FormGroup ( { } )
      }
    ] )
  }

  public async removeHero ( id: string ) {
    this.loading.set ( true )
    this.heroData.set ( this.heroData ( ).filter ( h => h.id !== id ) )
    try {
      if ( !this.model.pageID ) {
        this.toastrSvc.error ( "Page ID is not set. Cannot remove hero." )
        return
      }

      // POST data to the new Firestore backend router
      await this.apiSvc.delete ( `/api/admin/hero-editor/${this.model.pageID}`, { }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.toastrSvc.success ( "Hero removed successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to remove hero." )
    } finally {
      this.loading.set ( false )
    }
  }

  public async saveHeroData ( ) {
    if ( this.loading ( ) ) return
    if ( this.heroData ( ).some ( hero => !hero.model?.url || hero.model?.url.trim ( ) === "" ) ) {
      this.toastrSvc.error ( "Please ensure all heroes have an image URL before saving." )
      return
    }

    this.loading.set ( true )
    try {
      if ( !this.model.pageID ) {
        this.toastrSvc.error ( "Page ID is not set. Cannot save hero data." )
        return
      }

      await this.apiSvc.post ( `/api/admin/hero-editor/${this.model.pageID}`, {
        heroes: this.heroData ( ).map ( hero => {
          return {
            id: hero.id,
            url: hero.model.url,
            title: hero.model?.title || "",
            description: hero.model?.description || ""
          }
        } )
      }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.toastrSvc.success ( "Hero data saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save hero data." )
    } finally {
      this.loading.set ( false )
    }
  }

  private async fetchHeroData ( ) {
    this.loading.set ( true )
    try {
      if ( !this.model.pageID ) {
        this.heroData.set ( [ ] )
        return
      }

      const response = await this.apiSvc.get ( `/api/admin/hero-editor/${this.model.pageID}`, { } )
      const data = response as { heroes: HeroEntry [ ] }
      // Initialize with default if response is empty
      this.heroData.set ( data.heroes.map ( hero => ( {
        id: hero.id,
        fields: this.getHeroEntryFields ( ),
        model: {
          url: hero.url,
          title: hero.title,
          description: hero.description
        },
        form: new FormGroup ( { } )
      } ) ) )
    } catch ( e ) {
      console.error ( "Error fetching hero data:", e )
      this.toastrSvc.error ( "Failed to load hero data." )
      this.heroData.set ( [ ] )
    } finally {
      this.loading.set ( false )
    }
  }

  private getHeroEntryFields ( ): FormlyFieldConfig [ ] {
    return [
      this.formlySvc.TextInput ( "title", {
        label: "Hero Title",
        maxLength: 100
      } ),
      this.formlySvc.TextAreaInput ( "description", {
        label: "Hero Description",
        maxLength: 500,
      } ),
      this.formlySvc.ImagePickerInput ( "url", {
        label: "Hero Image URL",
        placeholder: "Select or enter the image URL for the hero",
        required: true
      } )
    ]
  }
}