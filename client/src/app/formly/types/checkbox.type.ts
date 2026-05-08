import { ChangeDetectionStrategy, Component } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { ReactiveFormsModule } from "@angular/forms"

@Component ( {
  selector: "app-formly-field-checkbox",
  imports: [ ReactiveFormsModule ],
  templateUrl: "./checkbox.type.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FormlyFieldCheckboxComponent extends FieldType { }
