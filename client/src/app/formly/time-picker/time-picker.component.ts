import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms"

@Component ( {
  selector: "app-time-picker",
  imports: [
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: "./time-picker.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class TimePickerComponent extends FieldType implements OnInit {
  public control: FormControl | undefined

  public ngOnInit ( ) {
    this.control = this.formControl as FormControl
  }
}
