import { ChangeDetectionStrategy, Component, Input, output, signal, WritableSignal } from "@angular/core"
import { IconComponent } from "../../../icon/icon.component"
import { FormsModule } from "@angular/forms"
import { CATEGORIES } from "./prayers-editor.component"

export interface Reflection {
  id: string
  title: string
  category: "our-lady" | "our-lord" | "angels" | "martyrs"
  youtubeId: string
}

const generateId = ( ): string => Math.random ( ).toString ( 36 ).slice ( 2, 10 )

@Component ( {
  selector: "app-reflections-editor",
  imports: [ IconComponent, FormsModule ],
  templateUrl: "./reflections-editor.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class ReflectionsEditorComponent {
  @Input ( ) public reflections: Reflection [ ] = [ ]
  @Input ( ) public saving = false
  public readonly reflectionsChange = output<Reflection [ ]> ( )
  public readonly save = output<void> ( )

  public expandedReflection: WritableSignal<number | null> = signal ( null )

  public readonly categories = CATEGORIES

  public addReflection ( ): void {
    const r = [ ...this.reflections, { id: generateId ( ), title: "", category: "our-lord" as const, youtubeId: "" } ]
    this.reflectionsChange.emit ( r )
    this.expandedReflection.set ( r.length - 1 )
  }

  public removeReflection ( index: number ): void {
    const r = this.reflections.filter ( ( _, i ) => i !== index )
    this.reflectionsChange.emit ( r )
    if ( this.expandedReflection ( ) === index ) this.expandedReflection.set ( null )
  }

  public moveReflectionUp ( index: number ): void {
    if ( index === 0 ) return
    const r = [ ...this.reflections ]
    ;[ r [ index - 1 ], r [ index ] ] = [ r [ index ], r [ index - 1 ] ]
    this.reflectionsChange.emit ( r )
  }

  public moveReflectionDown ( index: number ): void {
    if ( index >= this.reflections.length - 1 ) return
    const r = [ ...this.reflections ]
    ;[ r [ index ], r [ index + 1 ] ] = [ r [ index + 1 ], r [ index ] ]
    this.reflectionsChange.emit ( r )
  }

  public updateReflection ( index: number, field: keyof Reflection, value: string ): void {
    const r = this.reflections.map ( ( item, i ) => i === index ? { ...item, [ field ]: value } : item )
    this.reflectionsChange.emit ( r )
  }

  public toggleReflection ( index: number ): void {
    this.expandedReflection.set ( this.expandedReflection ( ) === index ? null : index )
  }

  public reflectionsSomeEmpty ( ): boolean {
    return this.reflections.some ( r => !r.title.trim ( ) || !r.youtubeId.trim ( ) )
  }
}
