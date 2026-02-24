import { Location } from "@angular/common"
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, WritableSignal } from "@angular/core"
import { NavigationEnd, Router } from "@angular/router"
import { NgbDropdownModule } from "@ng-bootstrap/ng-bootstrap"
import { IconComponent } from "@revive/src/app/icon/icon.component"

@Component ( {
  selector: "app-navbar",
  imports: [
    NgbDropdownModule,
    IconComponent
  ],
  templateUrl: "./navbar.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class NavbarComponent implements OnInit {
  public url: WritableSignal<string> = signal ( "" )

  public readonly location: Location = inject ( Location )
  private readonly router: Router = inject ( Router )

  public ngOnInit ( ) {
    this.router.events.subscribe ( event => {
      if ( event instanceof NavigationEnd ) {
        this.url.set ( this.location.path ( ) )
      }
    } )
    this.url.set ( this.location.path ( ) )
  }

  public scrollTo ( id: string ) {
    requestAnimationFrame ( ( ) => {
      document.querySelector ( id )?.scrollIntoView ( { behavior: "smooth" } )
    } )
  }

  public goTo ( path: string, id?: string ) {
    this.router.navigate ( [ path ] )
    if ( id ) {
      this.scrollTo ( id )
    }
  }
}
