import { ChangeDetectionStrategy, Component } from "@angular/core"
import { NavbarComponent } from "../components/navbar/navbar.component"
import { FooterComponent } from "../components/footer/footer.component"
import { IconComponent } from "../../icon/icon.component"

@Component ( {
  selector: "app-donate-thankyou",
  imports: [
    NavbarComponent,
    FooterComponent,
    IconComponent
  ],
  templateUrl: "./donate-thankyou.component.html",
  styleUrl: "./donate-thankyou.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DonateThankyouComponent { }
