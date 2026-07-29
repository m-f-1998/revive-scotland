import { ChangeDetectionStrategy, Component, OnInit, signal, WritableSignal, inject } from "@angular/core"
import { FieldType, FormlyModule } from "@ngx-formly/core"
import { ReactiveFormsModule } from "@angular/forms"
import { DatesService } from "../../services/dates.service"

@Component ( {
  selector: "app-formly-date-picker",
  imports: [
    ReactiveFormsModule,
    FormlyModule,
  ],
  templateUrl: "./date-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class DatePickerComponent extends FieldType implements OnInit {
  public readonly datesSvc: DatesService = inject ( DatesService )
  public nativeValue: WritableSignal<string> = signal ( "" )

  public get minDateAttr ( ): string {
    const d = this.field.props?.[ "minDate" ]
    return d instanceof Date ? this.toInputValue ( d ) : ""
  }

  public get maxDateAttr ( ): string {
    const d = this.field.props?.[ "maxDate" ]
    return d instanceof Date ? this.toInputValue ( d ) : ""
  }

  public ngOnInit ( ) {
    const val = this.formControl?.value
    if ( val instanceof Date && !isNaN ( val.getTime ( ) ) ) {
      this.nativeValue.set ( this.toInputValue ( val ) )
    } else if ( typeof val === "string" ) {
      const parsed = new Date ( val )
      if ( !isNaN ( parsed.getTime ( ) ) ) {
        this.nativeValue.set ( this.toInputValue ( parsed ) )
      }
    }
  }

  public onNativeChange ( event: Event ): void {
    const input = ( event.target as HTMLInputElement ).value
    if ( !input ) {
      this.formControl?.setValue ( null )
      this.formControl?.markAsDirty ( )
      return
    }
    const date = new Date ( input )
    if ( !isNaN ( date.getTime ( ) ) ) {
      this.formControl?.setValue ( date )
      this.formControl?.markAsDirty ( )
    }
  }

  private toInputValue ( date: Date ): string {
    const y = date.getFullYear ( )
    const m = String ( date.getMonth ( ) + 1 ).padStart ( 2, "0" )
    const d = String ( date.getDate ( ) ).padStart ( 2, "0" )
    return `${y}-${m}-${d}`
  }
}
