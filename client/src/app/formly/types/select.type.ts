import { ChangeDetectionStrategy, Component, OnInit, signal, WritableSignal } from "@angular/core"
import { FieldType } from "@ngx-formly/core"
import { FormlySelectOptionsPipe, FormlySelectOption } from "@ngx-formly/core/select"
import { ReactiveFormsModule } from "@angular/forms"

@Component ( {
  selector: "app-formly-field-select",
  imports: [ ReactiveFormsModule ],
  templateUrl: "./select.type.html",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class FormlyFieldSelectComponent extends FieldType implements OnInit {
  public readonly resolvedOptions: WritableSignal<FormlySelectOption[]> = signal ( [] )

  private readonly pipe = new FormlySelectOptionsPipe ( )

  public ngOnInit ( ): void {
    this.pipe.transform ( this.props.options, this.field ).subscribe ( opts => {
      this.resolvedOptions.set ( opts )
    } )
  }
}
