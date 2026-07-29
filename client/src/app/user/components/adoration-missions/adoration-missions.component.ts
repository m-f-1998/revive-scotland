import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { ApiService } from "@revive/src/app/services/api.service"

interface AdorationContent {
  title: string
  body: string
}

const FALLBACK: AdorationContent = {
  title: "Adoration Missions",
  body: "We offer to run a parish adoration mission in which we work together with the parish priest to prepare and run continuous adoration for set periods of time either with the goal of increasing already existing adoration in the parish or to help begin this devotional practice. For more information on what a mission can look like, please Contact Us."
}

@Component ( {
  selector: "app-adoration-missions",
  templateUrl: "./adoration-missions.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AdorationMissionsComponent implements OnInit {
  public content: WritableSignal<AdorationContent> = signal ( FALLBACK )

  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/site-content/adoration" ).then ( data => {
      const res = data as Partial<AdorationContent>
      if ( res.title ) this.content.set ( { ...FALLBACK, ...res } )
    } ).catch ( ( ) => { /* keep fallback */ } )
  }

  public goToContact ( ): void {
    document.getElementById ( "contact" )?.scrollIntoView ( { behavior: "smooth" } )
  }
}
