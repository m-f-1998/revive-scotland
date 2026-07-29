import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { ApiService } from "@revive/src/app/services/api.service"

interface PilgrimageContent {
  heading: string
  body: string
  image: string
}

const FALLBACK: PilgrimageContent = {
  heading: "Pilgrimages",
  body: "All our pilgrimages are in a true spirit of simplicity where we forgo the luxuries and pleasures of the world in order to be able to appreciate the basic things in life. All pilgrimages include daily mass and prayer time and a series of formational talks. We are also able to design and lead pilgrimages suited for parish, youth and other groups. Please contact us directly if you wish to set up a custom pilgrimage.",
  image: "pilgrimage.jpg"
}

@Component ( {
  selector: "app-pilgrimage",
  templateUrl: "./pilgrimage.component.html",
  styleUrl: "./pilgrimage.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class PilgrimageComponent implements OnInit {
  public content: WritableSignal<PilgrimageContent> = signal ( FALLBACK )

  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/site-content/pilgrimage" ).then ( data => {
      const res = data as Partial<PilgrimageContent>
      if ( res.heading ) this.content.set ( { ...FALLBACK, ...res } )
    } ).catch ( ( ) => { /* keep fallback */ } )
  }
}
