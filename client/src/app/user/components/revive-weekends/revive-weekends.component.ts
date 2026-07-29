import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { ApiService } from "@revive/src/app/services/api.service"

interface ReviveWeekendsContent {
  title: string
  description: string
  videoUrl: string
}

const FALLBACK: ReviveWeekendsContent = {
  title: "Revive Weekends",
  videoUrl: "/api/img/gallery/kinloss/kinloss-14.mp4",
  description: "A Revive Weekend is a profound Catholic experience designed to delve deeper into specific aspects of the faith while fostering a sense of community and spiritual growth among young adults.\n\nRooted in prayer, particularly through the Mass, adoration and the rosary, these weekends offer participants an opportunity for profound spiritual renewal and connection with God. The core aim of Revive Weekends is to bring young adults together in a supportive environment where they can deepen their understanding of the Catholic faith and build lasting friendships.\n\nAlongside structured prayer, Revive Weekends also include quality social time, engaging games, and thoughtful discussions aimed at facilitating personal reflection and sharing.\n\nWhether through moments of worship, fellowship, or recreation, Revive Weekends provide an experience that nurtures both the soul and the spirit, empowering participants to grow in their faith and relationship with God while forging meaningful connections with others on the journey of faith."
}

@Component ( {
  selector: "app-revive-weekends",
  templateUrl: "./revive-weekends.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ReviveWeekendsComponent implements OnInit {
  public content: WritableSignal<ReviveWeekendsContent> = signal ( FALLBACK )

  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/site-content/revive-weekends" ).then ( data => {
      const res = data as Partial<ReviveWeekendsContent>
      if ( res.title ) this.content.set ( { ...FALLBACK, ...res } )
    } ).catch ( ( ) => { /* keep fallback */ } )
  }
}
