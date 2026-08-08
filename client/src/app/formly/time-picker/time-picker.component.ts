import { ChangeDetectionStrategy, Component, OnInit, signal, WritableSignal } from "@angular/core"
import { FieldType, FormlyModule } from "@ngx-formly/core"
import { ReactiveFormsModule } from "@angular/forms"

@Component ( {
  selector: "app-formly-time-picker",
  imports: [
    ReactiveFormsModule,
    FormlyModule,
  ],
  templateUrl: "./time-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class TimePickerComponent extends FieldType implements OnInit {
  public nativeValue: WritableSignal<string> = signal ( "" )

  public ngOnInit ( ) {
    const val = this.formControl?.value
    if ( typeof val === "string" ) {
      this.nativeValue.set ( val )
    }
  }

  public onNativeChange ( event: Event ): void {
    const input = ( event.target as HTMLInputElement ).value
    if ( !input ) {
      this.formControl?.setValue ( null )
      this.formControl?.markAsDirty ( )
      return
    }
    this.formControl?.setValue ( input )
    this.formControl?.markAsDirty ( )
  }
}
