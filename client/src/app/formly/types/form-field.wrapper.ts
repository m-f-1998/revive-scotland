import { ChangeDetectionStrategy, Component } from "@angular/core"
import { FieldWrapper, FormlyModule } from "@ngx-formly/core"

@Component ( {
  selector: "app-formly-wrapper-form-field",
  imports: [ FormlyModule ],
  templateUrl: "./form-field.wrapper.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FormlyWrapperFormFieldComponent extends FieldWrapper { }
