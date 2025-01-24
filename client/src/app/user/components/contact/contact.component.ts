import { ChangeDetectionStrategy, Component } from "@angular/core"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faEnvelope, faPhone } from "@fortawesome/free-solid-svg-icons"

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
  public img = "img/contact-bg.jpg"
  public contacts = [
    {
      icon: faPhone,
      text: "+447883824055",
      link: "tel:+447883824055"
    },
    {
      icon: faEnvelope,
      text: "revivescotlandx@gmail.com",
      link: "mailto:revivescotlandx@gmail.com"
    }
  ]
}
