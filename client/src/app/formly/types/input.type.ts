import { ChangeDetectionStrategy, Component } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { ReactiveFormsModule, FormControl } from "@angular/forms"

@Component ( {
  selector: "app-formly-field-input",
  imports: [ ReactiveFormsModule ],
  templateUrl: "./input.type.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FormlyFieldInputComponent extends FieldType {
  public get fc (): FormControl { return this.formControl as FormControl }
}
