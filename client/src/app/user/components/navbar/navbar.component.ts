import { Location } from "@angular/common"
import { ChangeDetectionStrategy, Component, OnInit, signal, WritableSignal } from "@angular/core"
import { Router, RouterLink } from "@angular/router"

@Component ( {
  selector: "app-navbar",
  imports: [
    RouterLink
  ],
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class NavbarComponent implements OnInit {
  public navItems: WritableSignal<any> = signal ( {
    "": [
      {
        href: "/events",
        title: "Event Sign Up"
      },
      {
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
        onclick: () => this.scrollTo ( "#support" ),
        title: "Support"
      },
      {
        onclick: () => this.scrollTo ( "#contact" ),
        title: "Contact"
      }
    ],
    "/events": [
      {
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
    console.log ( this.location.path ( ) )
    return Object.keys ( this.navItems ( ) ).includes ( this.location.path ( ) )
  }
}
