import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { AdminNavbarComponent } from "../navbar/navbar.component"
import { AdminFooterComponent } from "../footer/footer.component"
import { IconComponent } from "../../icon/icon.component"
import { FormsModule } from "@angular/forms"
import { ApiService } from "../../services/api.service"
import { AuthService } from "../../services/auth.service"
import { ToastrService } from "@m-f-1998/ngx-toastr"
import { HttpHeaders } from "@angular/common/http"

interface StoryItem {
  description: string
  bullet: boolean
}

const DEFAULT_STORY: StoryItem [ ] = [
  {
    bullet: false,
    description: "At Revive Scotland, our journey is deeply informed by a robust background in catechesis, bolstered by academic achievements including both a BA in Catholic Theology and an MA in Applied Catholic Theology. This academic foundation enriches our understanding and practice of the faith, enabling us to effectively convey its teachings and significance to others."
  },
  {
    bullet: true,
    description: "Our commitment to youth work under the patronage of St John Bosco extends beyond mere engagement, encompassing a holistic approach to nurturing spiritual growth and real friendships."
  },
  {
    bullet: true,
    description: "Alongside organising pilgrimages, Revive Weekends and other events such as our recent trip to World Youth Day, our dedication to parish-related apostolates especially building Eucharistic Adoration and parish youth groups underscore our hands-on involvement in the everyday life of the Church."
  },
  {
    bullet: true,
    description: "We take pride in fostering transformative spaces through the development and leadership of children's, youth, and young adults groups, providing avenues for exploration and growth in the Catholic faith. Furthermore, we provide comprehensive leadership training for youth group leaders, empowering them to effectively guide and mentor others in their spiritual journeys."
  },
  {
    bullet: false,
    description: "Because of our experience in organising and leading Eucharistic adoration at both parish and mission levels, we are steadfast in our commitment to fostering deep reverence and devotion within our communities. At Revive Scotland, we are dedicated to inspiring spiritual renewal and fostering community cohesion, drawing upon our diverse backgrounds and experiences to serve as catalysts for transformation and growth."
  }
]

@Component ( {
  selector: "app-admin-story-editor",
  imports: [ AdminNavbarComponent, AdminFooterComponent, IconComponent, FormsModule ],
  templateUrl: "./story-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class StoryEditorComponent implements OnInit {
  public loading: WritableSignal<boolean> = signal ( true )
  public items: WritableSignal<StoryItem [ ]> = signal ( [ ] )

  private readonly apiSvc: ApiService = inject ( ApiService )
  private readonly authSvc: AuthService = inject ( AuthService )
  private readonly toastrSvc: ToastrService = inject ( ToastrService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/our-story" ).then ( data => {
      const res = data as { items: StoryItem [ ] }
      this.items.set ( res.items?.length ? res.items : [ ...DEFAULT_STORY ] )
    } ).catch ( ( ) => {
      this.toastrSvc.error ( "Failed to load Our Story content." )
    } ).finally ( ( ) => {
      this.loading.set ( false )
    } )
  }

  public addItem ( ): void {
    this.items.update ( items => [ ...items, { description: "Enter paragraph text here...", bullet: true } ] )
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
    const current = this.items ( )
    if ( index >= current.length - 1 ) return
    this.items.update ( items => {
      const copy = [ ...items ]
      ;[ copy [ index ], copy [ index + 1 ] ] = [ copy [ index + 1 ], copy [ index ] ]
      return copy
    } )
  }

  public updateDescription ( index: number, value: string ): void {
    this.items.update ( items => items.map ( ( item, i ) =>
      i === index ? { ...item, description: value } : item
    ) )
  }

  public toggleBullet ( index: number ): void {
    this.items.update ( items => items.map ( ( item, i ) =>
      i === index ? { ...item, bullet: !item.bullet } : item
    ) )
  }

  public someEmpty ( ): boolean {
    return this.items ( ).some ( item => !item.description.trim ( ) )
  }

  public async save ( ): Promise<void> {
    if ( this.someEmpty ( ) ) {
      this.toastrSvc.error ( "All items must have a description before saving." )
      return
    }

    this.loading.set ( true )
    try {
      await this.apiSvc.post ( "/api/admin/our-story", { items: this.items ( ) }, new HttpHeaders ( {
        "Authorization": `Bearer ${await this.authSvc.currentUser ( )?.getIdToken ( ) || ""}`
      } ) )
      this.toastrSvc.success ( "Our Story saved successfully!" )
    } catch {
      this.toastrSvc.error ( "Failed to save Our Story content." )
    } finally {
      this.loading.set ( false )
    }
  }
}
