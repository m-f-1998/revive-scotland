import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { NgbModal } from "@ng-bootstrap/ng-bootstrap"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { ApiService } from "../../services/api.service"
import { FileExplorerComponent } from "../file-explorer/file-explorer.component"
import { HeroEntry, PageHeroData } from "../../interfaces/heroEditor.interface"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "../../services/icons.service"
import { HttpHeaders } from "@angular/common/http"
import { AuthService } from "../../services/auth.service"
import { FormlyFieldConfig, FormlyForm } from "@ngx-formly/core"
import { FormGroup } from "@angular/forms"
import { FormlyService } from "../../services/formly.service"

@Component ( {
  selector: "app-admin-hero-editor",
  imports: [
    AdminNavbarComponent,
    FaIconComponent,
    FormlyForm
  ],
  templateUrl: "./hero-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class HeroEditorComponent implements OnInit {
  public readonly maxHeroes = 3

  public heroData: WritableSignal<PageHeroData> = signal ( { heroes: [ ] } )
  public loading: WritableSignal<boolean> = signal ( false )

  public form: FormGroup = new FormGroup ( { } )
  public model: any = { }
  public fields: FormlyFieldConfig [ ] = [ ]

  public readonly iconSvc: IconService = inject ( IconService )
  private readonly modalSvc: NgbModal = inject ( NgbModal )
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
    if ( this.heroData ( ).heroes.length >= this.maxHeroes ) {
      this.toastrSvc.error ( `Cannot add more than ${this.maxHeroes} heroes.` )
      return
    }
    const newHero: HeroEntry = {
      id: `hero-${Date.now ( )}`,
      url: "",
      title: "",
      description: ""
    }
    this.heroData.update ( data => ( {
      ...data,
      heroes: [ ...data.heroes, newHero ]
    } ) )
  }

  public async removeHero ( id: string ) {
    this.loading.set ( true )
    this.heroData.update ( data => ( {
      ...data,
      heroes: data.heroes.filter ( ( h: HeroEntry ) => h.id !== id )
    } ) )
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
    if ( this.heroData ( ).heroes.some ( h => !h.url ) ) {
      this.toastrSvc.error ( "Please ensure all heroes have an image URL before saving." )
      return
    }

    this.loading.set ( true )
    try {
      if ( !this.model.pageID ) {
        this.toastrSvc.error ( "Page ID is not set. Cannot save hero data." )
        return
      }

      await this.apiSvc.post ( `/api/admin/hero-editor/${this.model.pageID}`, this.heroData ( ), new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || "" }`
      } ) )
      this.toastrSvc.success ( "Hero data saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save hero data." )
    } finally {
      this.loading.set ( false )
    }
  }

  public openFileSelector ( heroToUpdate: HeroEntry ) {
    const modalRef = this.modalSvc.open ( FileExplorerComponent, { size: "xl", centered: true } )

    // Set the flag to enable selection mode
    modalRef.componentInstance.isSelectionMode = true

    // Handle the result (the permanent signed URL) from the File Explorer
    modalRef.result.then ( ( result: string | undefined ) => {
      if ( result ) {
        // Update the specific hero entry with the new URL
        this.heroData.update ( data => ( {
          ...data,
          heroes: data.heroes.map ( ( hero: HeroEntry ) =>
            hero.id === heroToUpdate.id ? { ...hero, url: result } : hero
          )
        } ) )
        // Save changes automatically after selection
        this.saveHeroData ( )
      }
    } ).catch ( ( ) => { /* Modal dismissed */ } )
  }

  private async fetchHeroData ( ) {
    this.loading.set ( true )
    try {
      if ( !this.model.pageID ) {
        this.heroData.set ( { heroes: [ ] } )
        return
      }

      const response = await this.apiSvc.get ( `/api/admin/hero-editor/${this.model.pageID}`, { } )
      const data = response as PageHeroData
      // Initialize with default if response is empty
      this.heroData.set ( data.heroes ? data : { heroes: [ ] } )
    } catch ( e ) {
      console.error ( "Error fetching hero data:", e )
      this.toastrSvc.error ( "Failed to load hero data." )
      this.heroData.set ( { heroes: [ ] } )
    } finally {
      this.loading.set ( false )
    }
  }
}