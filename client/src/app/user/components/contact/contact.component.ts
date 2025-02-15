import { ChangeDetectionStrategy, Component, input, InputSignal } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons"
import { faInstagram } from "@fortawesome/free-brands-svg-icons"
@Component ( {
  selector: "app-contact",
  imports: [
    FaIconComponent
  ],
  templateUrl: "./contact.component.html",
  styleUrl: "./contact.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ContactComponent {
  public readonly img: InputSignal<string> = input ( "assets/img/contact-bg.jpg" )
  public contacts = [
    {
      icon: faPhone,
      text: "+447883824055",
      link: "tel:+447883824055"
    },
    {
      icon: faEnvelope,
      text: "luca@revivescotland.co.uk",
      link: "mailto:luca@revivescotland.co.uk"
    },
    {
      icon: faInstagram,
      text: "@revivescotland",
      link: "https://www.instagram.com/revive.scotland"
    }
  ]
}
