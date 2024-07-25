import { Location } from "@angular/common"
import { Component } from "@angular/core"
import { RouterLink } from "@angular/router"

@Component ( {
  selector: "app-navbar",
  standalone: true,
  imports: [
    RouterLink
  ],
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.scss"
} )
export class NavbarComponent {
  public navItems: any = {
    "": [
      {
        href: "/events",
        title: "Event Sign Up"
      },
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
    ],
    "/admin/dashboard": [
      {
        href: "/admin/registrations",
        title: "Event Registrations"
      },
      {
        href: "/admin/policies",
        title: "Event Policies"
      }
    ],
    "/admin/registrations": [
      {
        href: "/admin/dashboard",
        title: "Events"
      },
      {
        href: "/admin/policies",
        title: "Event Policies"
      }
    ],
    "/admin/policies": [
      {
        href: "/admin/dashboard",
        title: "Events"
      },
      {
        href: "/admin/registrations",
        title: "Event Registrations"
      }
    ],
  }

  public constructor (
    public location: Location
  ) { }

  public scrollTo ( id: string ) {
    document.querySelector ( id )?.scrollIntoView ( { behavior: "smooth" } )
  }

  public showNav ( ) {
    return Object.keys ( this.navItems ).includes ( this.location.path ( ) )
  }
}
