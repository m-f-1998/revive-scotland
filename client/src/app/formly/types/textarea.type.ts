import { ChangeDetectionStrategy, Component } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { ReactiveFormsModule } from "@angular/forms"

@Component ( {
  selector: "app-formly-field-textarea",
  imports: [ ReactiveFormsModule ],
  templateUrl: "./textarea.type.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FormlyFieldTextareaComponent extends FieldType { }
