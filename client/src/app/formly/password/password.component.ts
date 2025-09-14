import { ChangeDetectionStrategy, Component, OnInit, WritableSignal, inject, signal } from "@angular/core"
import { FieldType, FieldTypeConfig, FormlyAttributes } from "@ngx-formly/core"
import { FormControl, ReactiveFormsModule } from "@angular/forms"
import { FaIconComponent } from "@fortawesome/angular-fontawesome"
import { IconService } from "@services/icons.service"

@Component ( {
  selector: "iqx-password",
  imports: [
    ReactiveFormsModule,
    FormlyAttributes,
    FaIconComponent
  ],
  templateUrl: "./password.component.html",
  styleUrl: "./password.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
} )
export class PasswordComponent extends FieldType<FieldTypeConfig> implements OnInit {
  public readonly iconSvc: IconService = inject ( IconService )

  public control: FormControl | undefined
  public fieldType: FieldTypeConfig | undefined

  public warnings: WritableSignal<string> = signal ( "" )
  public showPassword: WritableSignal<boolean> = signal ( false )

  public ngOnInit ( ) {
    this.control = this.formControl as FormControl
    this.fieldType = this.field as FieldTypeConfig
  }
}