import { ChangeDetectionStrategy, Component } from "@angular/core"

@Component ( {
  selector: "app-pilgrimage",
  templateUrl: "./pilgrimage.component.html",
  styleUrl: "./pilgrimage.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class PilgrimageComponent {

  public img = "img/pilgrimage.jpg"

}
