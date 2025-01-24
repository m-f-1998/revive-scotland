import { ChangeDetectionStrategy, Component } from "@angular/core"

@Component ( {
  selector: "app-pilgramages",
  templateUrl: "./pilgramages.component.html",
  styleUrl: "./pilgramages.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class PilgramagesComponent {

  public img = "img/pilgramages.jpg"

}
