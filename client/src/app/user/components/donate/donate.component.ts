import { ChangeDetectionStrategy, Component } from "@angular/core"

@Component ( {
  selector: "app-donate",
  templateUrl: "./donate.component.html",
  styleUrl: "./donate.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DonateComponent {}
