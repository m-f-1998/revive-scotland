import { Location } from "@angular/common"
import { ChangeDetectionStrategy, Component, OnInit, signal, WritableSignal } from "@angular/core"
import { Router, RouterLink } from "@angular/router"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { faCalendar, faCross, faEnvelope, faHandshake, faHome } from "@fortawesome/free-solid-svg-icons"

@Component ( {
  selector: "app-navbar",
  imports: [
    RouterLink,
    FaIconComponent
  ],
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class NavbarComponent implements OnInit {
  public navItems: WritableSignal<any> = signal ( {
    "": [
      {
        icon: faCalendar,
        href: "/events",
        title: "Event Sign Up"
      },
      {
        icon: faCross,
        title: "Missions",
        dropdown: true,
        children: [
          {
            onclick: () => this.scrollTo ( "#pilgramages" ),
            title: "Pilgramages"
          },
          {
            onclick: () => this.scrollTo ( "#adoration" ),
            title: "Adoration"
          },
          {
            onclick: () => this.scrollTo ( "#weekends" ),
            title: "Revive Weekends"
          }
        ]
      },
      {
        icon: faHandshake,
        onclick: () => this.scrollTo ( "#support" ),
        title: "Support"
      },
      {
        icon: faEnvelope,
        onclick: () => this.scrollTo ( "#contact" ),
        title: "Contact"
      }
    ],
    "/events": [
      {
        icon: faHome,
        href: "/",
        title: "Home"
      }
    ]
  } )

  public path: WritableSignal<string> = signal ( this.location.path ( ) )

  public constructor (
    public location: Location,
    private router: Router
  ) { }

  public ngOnInit ( ) {
    this.router.events.subscribe ( ( ) => {
      this.path.set ( this.location.path ( ) )
    } )
  }

  public scrollTo ( id: string ) {
    document.querySelector ( id )?.scrollIntoView ( { behavior: "smooth" } )
  }

  public showNav ( ) {
    return Object.keys ( this.navItems ( ) ).includes ( this.path ( ) )
  }
}
