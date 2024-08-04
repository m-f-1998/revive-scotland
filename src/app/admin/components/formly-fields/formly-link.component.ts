import { Component } from "@angular/core"
import { FieldType, FieldTypeConfig } from "@ngx-formly/core"

@Component({
 selector: "formly-link",
 template: `
    <div class="mb-2">
      <a [href]="formControl.defaultValue">{{ to.label }}</a>
    </div>
 `,
})
export class FormlyLink extends FieldType<FieldTypeConfig> {}