import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { FormsModule } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { HttpHeaders } from "@angular/common/http"

interface Testimony {
  name: string
  testimony: string
}

const DEFAULT_TESTIMONIALS: Testimony [ ] = [
  { name: "Largs - 2023", testimony: "I loved the talks and company and the overall structure of the retreat. Incredible experience." },
  { name: "Hawick - 2023", testimony: "This has made me want to create better friendships and discipleship in our parishes and to become a light for our communities" },
  { name: "Largs - 2023", testimony: "There was a lot of time for adoration and the games were great fun, the talks were amazing and it was a great choice of topics and speakers" },
  { name: "Largs - 2023", testimony: "The schedule was well organised, the food was well-organised and the talks were very interesting – I loved the testimonies from the priests" },
  { name: "Dunoon - 2026", testimony: "The content has given me a new perspective on scripture, the mass and liturgy which helps me to appreciate more fully its inherent beauty" },
  { name: "Dunoon - 2026", testimony: "I have grown in a deeper understanding of a relationship with God and others" },
  { name: "Dunoon - 2026", testimony: "I had new revelations about my faith and how I can grow and improve my relationship with God and others" },
  { name: "Dunoon - 2026", testimony: "This weekend made me rediscover myself in the light of God and the needs I can work on! Thank you so much for organising, I really enjoyed being a part of this community" },
  { name: "Dunoon - 2026", testimony: "I have learnt so much over the weekend. Going into detail about dissonant needs has helped me clarify things to address in my own life and how to work on them. I found this retreat very fruitful" },
  { name: "Dunoon - 2026", testimony: "I have been able to surrender to the will of God more" },
  { name: "Dunoon - 2026", testimony: "Finding out how men and women most closely imitate the Blessed Trinity when they're embracing in marital union was so healing and such a beautiful truth that has been revealed to me this weekend!" },
  { name: "Dunoon - 2026", testimony: "Very profound encounter with the goodness of God and His plan for human relationships, marriage and liturgy. Father's talks were deep but relatable and I loved the vulnerability of the men's groups discussion." }
]

@Component ( {
  selector: "app-admin-testimonials-editor",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, FormsModule ],
  templateUrl: "./testimonials-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class TestimonialsEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public saving: WritableSignal<boolean> = signal ( false )
  public items: WritableSignal<Testimony [ ]> = signal ( [ ] )
  public isUsingDefaults: WritableSignal<boolean> = signal ( false )
  public expandedIndex: WritableSignal<number | null> = signal ( null )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/site-content/testimonials" ).then ( data => {
      const res = data as { items?: Testimony [ ] }
      if ( res.items?.length ) {
        this.items.set ( res.items )
      } else {
        this.items.set ( [ ...DEFAULT_TESTIMONIALS ] )
        this.isUsingDefaults.set ( true )
      }
    } ).catch ( ( ) => {
      this.toastrSvc.error ( "Failed to load testimonials." )
    } ).finally ( ( ) => this.loading.set ( false ) )
  }

  public addItem ( ): void {
    this.isUsingDefaults.set ( false )
    this.items.update ( items => [ ...items, { name: "Event Name - Year", testimony: "Enter testimony here..." } ] )
    this.expandedIndex.set ( this.items ( ).length - 1 )
  }

  public restoreDefaults ( ): void {
    this.items.set ( [ ...DEFAULT_TESTIMONIALS ] )
    this.isUsingDefaults.set ( true )
    this.expandedIndex.set ( null )
  }

  public toggleExpand ( index: number ): void {
    this.expandedIndex.set ( this.expandedIndex ( ) === index ? null : index )
  }

  public removeItem ( index: number ): void {
    this.items.update ( items => items.filter ( ( _, i ) => i !== index ) )
  }

  public moveUp ( index: number ): void {
    if ( index === 0 ) return
    this.items.update ( items => {
      const copy = [ ...items ]
      ;[ copy [ index - 1 ], copy [ index ] ] = [ copy [ index ], copy [ index - 1 ] ]
      return copy
    } )
  }

  public moveDown ( index: number ): void {
    if ( index >= this.items ( ).length - 1 ) return
    this.items.update ( items => {
      const copy = [ ...items ]
      ;[ copy [ index ], copy [ index + 1 ] ] = [ copy [ index + 1 ], copy [ index ] ]
      return copy
    } )
  }

  public updateField ( index: number, field: keyof Testimony, value: string ): void {
    this.isUsingDefaults.set ( false )
    this.items.update ( items => items.map ( ( item, i ) =>
      i === index ? { ...item, [ field ]: value } : item
    ) )
  }

  public someEmpty ( ): boolean {
    return this.items ( ).some ( item => !item.name.trim ( ) || !item.testimony.trim ( ) )
  }

  public async save ( ): Promise<void> {
    if ( this.someEmpty ( ) ) {
      this.toastrSvc.error ( "All testimonials need a name and text before saving." )
      return
    }

    this.saving.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/site-content/testimonials", { items: this.items ( ) }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Testimonials saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save testimonials." )
    } finally {
      this.saving.set ( false )
    }
  }
}
