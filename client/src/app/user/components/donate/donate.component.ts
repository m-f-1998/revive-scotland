import { NgOptimizedImage } from "@angular/common"
import { ChangeDetectionStrategy, Component } from "@angular/core"

@Component ( {
  selector: "app-donate",
  imports: [
    NgOptimizedImage
  ],
  templateUrl: "./donate.component.html",
  styleUrl: "./donate.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DonateComponent { }
