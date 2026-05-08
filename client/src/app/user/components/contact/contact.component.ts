import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { IconComponent } from "@revive/src/app/icon/icon.component"
import { ApiService } from "@revive/src/app/services/api.service"

interface ContactDetails {
  phone: string
  email: string
  instagram: string
}

const FALLBACK: ContactDetails = {
  phone: "+447883824055",
  email: "luca@revivescotland.co.uk",
  instagram: "revive.scotland"
}

@Component ( {
  selector: "app-contact",
  imports: [ IconComponent ],
  templateUrl: "./contact.component.html",
  styleUrl: "./contact.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ContactComponent implements OnInit {
  public details: WritableSignal<ContactDetails> = signal ( FALLBACK )

  private readonly apiSvc: ApiService = inject ( ApiService )

  public ngOnInit ( ): void {
    this.apiSvc.get ( "/api/admin/contact-details" ).then ( data => {
      this.details.set ( data as ContactDetails )
    } ).catch ( ( ) => { /* keep fallback */ } )
  }
}
