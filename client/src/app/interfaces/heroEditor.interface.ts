import { FormGroup } from "@angular/forms"
import { FormlyFieldConfig } from "@ngx-formly/core"

export interface HeroEntry {
  id: string
  url: string // The permanent/long-lived signed URL
  title: string
  description: string
}

export interface PageHeroData {
  id: string
  fields: FormlyFieldConfig [ ]
  model: any
  form: FormGroup
}