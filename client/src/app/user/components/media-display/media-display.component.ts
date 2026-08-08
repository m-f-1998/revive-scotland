import { ChangeDetectionStrategy, Component, computed, input, Signal } from "@angular/core"

@Component ( {
  selector: "app-media-display",
  templateUrl: "./media-display.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class MediaDisplayComponent {
  public src = input.required<string> ( )
  public alt = input<string> ( "Media Content" )
  public objectFit = input<"cover" | "contain"> ( "cover" )

  public isVideo: Signal<boolean> = computed ( ( ) => {
    const s = this.src ( ).toLowerCase ( )
    return s.endsWith ( ".mp4" ) || s.endsWith ( ".webm" ) || s.endsWith ( ".ogg" )
  } )
}
