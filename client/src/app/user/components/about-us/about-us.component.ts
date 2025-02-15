import { ChangeDetectionStrategy, Component } from "@angular/core"
import { faBible, faChurch, faPrayingHands } from "@fortawesome/free-solid-svg-icons"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"

@Component ( {
  selector: "app-about-us",
  imports: [
    FaIconComponent
  ],
  templateUrl: "./about-us.component.html",
  styleUrl: "./about-us.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class AboutUsComponent {
  public aboutUs = [
    {
      icon: faBible,
      title: "Scripture",
      description: "We promote strongly the basic message of the Gospel and the transformative truth that the Holy Spirit is living and active within hearts that are in a state of grace."
    },
    {
      icon: faChurch,
      title: "Transformed by the Spirit",
      description: "We aim to provide a space for people to encounter the love of God and to be transformed by the power of the Holy Spirit."
    },
    {
      icon: faPrayingHands,
      title: "Evangelisation",
      description: "We focus, but are not limited to the evangelisation of youth and young adults with the aim to lead them to live a grace filled lifestyle, actively giving back to their own parish community."
    }
  ]
}
