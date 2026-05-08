import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { ApiService } from "@revive/src/app/services/api.service"
import { SolidIcon } from "@revive/src/app/icon/icon.registry"

interface AboutCard {
  icon: SolidIcon
  title: string
  description: string
}

const FALLBACK: AboutCard [ ] = [
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

@Component ( {
  selector: "app-about-us",
  imports: [ IconComponent ],
  templateUrl: "./about-us.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AboutUsComponent implements OnInit {
  public cards: WritableSignal<AboutCard [ ]> = signal ( FALLBACK )

  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/site-content/about-us" ).then ( data => {
      const res = data as { cards?: AboutCard [ ] }
      if ( res.cards?.length ) this.cards.set ( res.cards )
    } ).catch ( ( ) => { /* keep fallback */ } )
  }
}
