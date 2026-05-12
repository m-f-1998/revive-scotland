import { ChangeDetectionStrategy, Component, computed, input, output, signal } from "@angular/core"
import { brandIconNames, solidIconNames } from "../../icon/icon.registry"
import { IconComponent } from "../../icon/icon.component"

@Component ( {
  selector: "app-icon-picker",
  imports: [ IconComponent ],
  templateUrl: "./icon-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "(document:click)": "close()" }
} )
export class IconPickerComponent {
  public value = input.required<string> ( )
  public readonly valueChange = output<string> ( )

  public isOpen = signal ( false )
  public searchQuery = signal ( "" )

  public readonly allIcons: string[] = [ ...solidIconNames, ...brandIconNames ].sort ( )

  public filteredIcons = computed ( ( ) => {
    const q = this.searchQuery ( ).toLowerCase ( ).trim ( )
    if ( !q ) return this.allIcons
    return this.allIcons.filter ( icon => icon.includes ( q ) )
  } )

  public close ( ): void {
    this.isOpen.set ( false )
  }

  public toggle ( event: Event ): void {
    event.stopPropagation ( )
    const opening = !this.isOpen ( )
    this.isOpen.set ( opening )
    if ( opening ) this.searchQuery.set ( "" )
  }

  public selectIcon ( icon: string, event: Event ): void {
    event.stopPropagation ( )
    this.valueChange.emit ( icon )
    this.isOpen.set ( false )
    this.searchQuery.set ( "" )
  }

  public stopProp ( event: Event ): void {
    event.stopPropagation ( )
  }

  public onSearchInput ( event: Event ): void {
    this.searchQuery.set ( ( event.target as HTMLInputElement ).value )
  }
}
